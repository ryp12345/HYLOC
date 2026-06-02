import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getKPIs } from '../../api/kpiApi';
import { getPillers } from '../../api/pillerApi';
import { getUsers } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import api from '../../api/axios';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate fiscal month sequence for a given fiscal year (April to March)
const getFiscalMonthSequence = (fiscalYear) => {
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((3 + i) % 12) + 1; // April (4) through March (3)
    const year = month >= 4 ? fiscalYear : fiscalYear + 1;
    return { month, year };
  });
};

// SVG Line Chart Component for Industry 4.0 KPI
const Industry40LineChart = ({
  title,
  labels,
  actuals,
  targets,
  yAxisFormatter,
  showHeader = true,
  showAxisLabels = true,
  showPointLabels = false,
  xAxisTitle = 'Month',
  yAxisTitle = 'Value',
  isExpanded = false,
}) => {
  const svgWidth = 900;
  const svgHeight = 310;
  const padding = 85;
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
  const formatY = yAxisFormatter || ((v) => formatVal(v));

  // Generate line paths
  const actualPath = actuals
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');
  const targetPath = targets
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
    .join(' ');

  // Generate filled area paths for gradients
  const actualAreaPath = actuals.length > 0 ? (
    `${actualPath} L ${getX(actuals.length - 1)} ${svgHeight - padding} L ${getX(0)} ${svgHeight - padding} Z`
  ) : '';
  const targetAreaPath = targets.length > 0 ? (
    `${targetPath} L ${getX(targets.length - 1)} ${svgHeight - padding} L ${getX(0)} ${svgHeight - padding} Z`
  ) : '';

  const displayPointLabels = isExpanded || showPointLabels;
  const displayAxisLabels = isExpanded || showAxisLabels;

  return (
    <div className="w-full h-full flex flex-col">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      <div className="flex flex-row flex-1 min-h-0 items-center gap-1">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="flex-1 min-w-0 h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="industry40Gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#41aafe" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#41aafe" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="industry40TargetGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb74d" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffb74d" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Shaded Areas underneath lines */}
        {actualAreaPath && (
          <path d={actualAreaPath} fill="url(#industry40Gradient)" />
        )}
        {targetAreaPath && (
          <path d={targetAreaPath} fill="url(#industry40TargetGradient)" />
        )}

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
                {displayPointLabels && ( 
                  <text x={getX(idx)} y={getY(val) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#c97706">{formatY(Number(val))}</text> 
                )} 
          </g>
        ))}

        {/* Actual dots + labels */}
          {actuals.map((val, idx) => ( 
          <g key={`actual-dot-${idx}`}>
            <circle cx={getX(idx)} cy={getY(val)} r="5" fill="#41aafe" stroke="white" strokeWidth="2" />
                  {displayPointLabels && ( 
                    <text x={getX(idx)} y={getY(val) - 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0ea5e9">{formatY(Number(val))}</text> 
                  )} 
          </g>
        ))}

        {/* X-axis labels */}
        {labels.map((label, idx) => (
            <text
              key={`x-label-${idx}`}
              x={getX(idx)}
              y={svgHeight - padding + 30}
              textAnchor="middle"
              fontSize="13"
              fontWeight="500"
              fill="#4b5563"
            >
              {label}
            </text>
        ))}

        {/* Y-axis labels (formatted) */}
        {displayAxisLabels && (() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            return (
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">
                {formatY(tick)}
              </text>
            );
          });
        })()}

        {/* Axis titles */}
        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">
              {xAxisTitle}
            </text>
            <text
              x={22}
              y={svgHeight / 2}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#374151"
              transform={`rotate(-90 22 ${svgHeight / 2})`}
            >
              {yAxisTitle}
            </text>
          </>
        )}
      </svg>

      <div className="flex flex-col justify-center gap-2 pl-2 w-14 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-4 h-[3px] bg-[#41aafe] rounded flex-shrink-0"></span>
          <span className="text-[10px] text-gray-600">Actual</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-[3px] bg-[#ffb74d] rounded flex-shrink-0"></span>
          <span className="text-[10px] text-gray-600">Target</span>
        </div>
      </div>
      </div>
    </div>
  );
};

// Speedometer Gauge Component for Plant Efficiency
const SpeedometerGauge = ({ efficiency, month, year, isExpanded = false }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate angle: -180 to 0 degrees (left to right semicircle)
  // 0-60 red, 61-80 yellow, >80 green
  const angle = -180 + (Math.min(Math.max(efficiency, 0), 100) / 100) * 180;

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
    <div className={`flex flex-col items-center justify-center h-full min-h-0 relative z-10 ${isExpanded ? 'py-6 w-full max-w-[480px]' : ''}`}>
      <h3 className={`font-semibold text-gray-800 mb-1 whitespace-nowrap ${isExpanded ? 'text-2xl mb-4' : 'text-[10px] sm:text-xs'}`}>{month} {year}</h3>
      <svg 
        viewBox="0 0 300 200" 
        className="w-full h-auto flex-1 min-h-0" 
        style={{
          maxWidth: isExpanded ? '450px' : '300px',
          maxHeight: isExpanded ? '300px' : '100px'
        }}
      >
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

        {/* Needle & Arrow Tip Group with smooth transition */}
        <g 
          transform={`rotate(${angle}, 150, 150)`} 
          style={{ 
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' 
          }}
        >
          <line 
            x1="150" 
            y1="150" 
            x2="230" 
            y2="150" 
            stroke={color} 
            strokeWidth="4" 
            strokeLinecap="round" 
            style={{ transition: 'stroke 0.4s ease' }}
          />
          {/* Arrow tip correctly aligned and pointing right (at 230, 150) */}
          <polygon
            points="230,150 218,144 218,156"
            fill={color}
            style={{ transition: 'fill 0.4s ease' }}
          />
        </g>
        
        {/* Center dot */}
        <circle 
          cx="150" 
          cy="150" 
          r="8" 
          fill={color} 
          style={{ transition: 'fill 0.4s ease' }}
        />

        {/* Labels */}
        <text x="75" y="175" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">0</text>
        <text x="150" y="50" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">50</text>
        <text x="225" y="175" fontSize="12" fontWeight="600" fill="#4b5563" textAnchor="middle">100</text>
      </svg>
      
      <div className={`text-center ${isExpanded ? 'mt-3' : 'mt-0.5'}`}>
        <div className={`font-extrabold text-gray-800 ${isExpanded ? 'text-2xl' : 'text-base sm:text-lg'}`}>{efficiency.toFixed(1)}%</div>
        <div className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block ${
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
const GreenFactoryBarChart = ({ title, subtitle, labels, values, showHeader = true, showAxisLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Value', isExpanded = false }) => {
  const svgWidth = 900;
  const svgHeight = 270;
  const padding = 85;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 100);
  const minVal = 0;
  const range = maxVal - minVal;

  const barWidth = plotWidth / (values.length * 1.5);
  const getX = (idx) => padding + (idx * plotWidth) / values.length + (plotWidth / values.length / 2 - barWidth / 2);
  const getY = (val) => svgHeight - padding - ((val - minVal) / range) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / range) * plotHeight;

  const displayAxisLabels = isExpanded || showAxisLabels;

  return (
    <div className="w-full h-full flex flex-col">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      {showHeader && subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <div className="flex flex-row flex-1 min-h-0 items-center gap-1">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="flex-1 min-w-0 h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="greenFactoryBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>

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
            <rect x={getX(idx)} y={getY(val)} width={barWidth} height={getBarHeight(val)} fill="url(#greenFactoryBarGradient)" stroke="white" strokeWidth="1" rx="4" />
            <text x={getX(idx) + barWidth / 2} y={getY(val) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#10b981">{val.toFixed(1)}%</text>
          </g>
        ))}
        {displayAxisLabels && labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx * plotWidth) / labels.length + (plotWidth / labels.length / 2)} y={svgHeight - padding + 30} textAnchor="middle" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {displayAxisLabels && (() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString()) + '%';
            return (
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}

        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">{xAxisTitle}</text>
            <text x={22} y={svgHeight / 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" transform={`rotate(-90 22 ${svgHeight / 2})`}>{yAxisTitle}</text>
          </>
        )}
      </svg>
      <div className="flex flex-col justify-center gap-2 pl-2 w-16 flex-shrink-0">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#10b981] rounded flex-shrink-0"></span><span className="text-[10px] text-gray-600">Value %</span></div>
      </div>
      </div>
    </div>
  );
};

// Bar Chart component for Zero Accidents (shows actual vs target per month)
const ZeroAccidentsBarChart = ({ title, subtitle, labels, actuals, targets, showHeader = true, showAxisLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Value', isExpanded = false }) => {
  const svgWidth = 900;
  const svgHeight = 300;
  const padding = 85;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals, ...targets, 1);
  const minVal = 0;
  const range = maxVal - minVal;
  const groupWidth = plotWidth / labels.length;
  const barWidth = isExpanded ? Math.min(36, groupWidth * 0.35) : Math.min(24, groupWidth * 0.35);
  const getX = (idx, which) => {
    const base = padding + idx * groupWidth + groupWidth / 2;
    // which: 0 = actual (left), 1 = target (right)
    return base + (which === 0 ? -barWidth * 1.1 : barWidth * 0.1);
  };
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;

  const displayAxisLabels = isExpanded || showAxisLabels;

  return (
    <div className="w-full h-full flex flex-col">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      {showHeader && subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <div className="flex flex-row flex-1 min-h-0 items-center gap-1">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="flex-1 min-w-0 h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="zeroAccidentsActualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="zeroAccidentsTargetGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

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
            <rect x={getX(idx, 0)} y={getY(actuals[idx] || 0)} width={barWidth} height={getBarHeight(actuals[idx] || 0)} fill="url(#zeroAccidentsActualGradient)" rx="4" />
            <rect x={getX(idx, 1)} y={getY(targets[idx] || 0)} width={barWidth} height={getBarHeight(targets[idx] || 0)} fill="url(#zeroAccidentsTargetGradient)" rx="4" />

            <text x={getX(idx, 0) + barWidth / 2} y={getY(actuals[idx] || 0) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#2563eb">{(actuals[idx] || 0).toFixed(0)}</text>
            <text x={getX(idx, 1) + barWidth / 2} y={getY(targets[idx] || 0) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#d97706">{(targets[idx] || 0).toFixed(0)}</text>
          </g>
        ))}

        {displayAxisLabels && labels.map((label, idx) => (
            <text key={`x-label-${idx}`} x={padding + idx * groupWidth + groupWidth / 2} y={svgHeight - padding + 30} textAnchor="middle" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {displayAxisLabels && (() => {
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
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}

        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">{xAxisTitle}</text>
            <text x={22} y={svgHeight / 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" transform={`rotate(-90 22 ${svgHeight / 2})`}>{yAxisTitle}</text>
          </>
        )}
      </svg>

      <div className="flex flex-col justify-center gap-2 pl-2 w-16 flex-shrink-0">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#2563eb] rounded flex-shrink-0"></span><span className="text-[10px] text-gray-600">Actual</span></div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#d97706] rounded flex-shrink-0"></span><span className="text-[10px] text-gray-600">Target</span></div>
      </div>
      </div>
    </div>
  );
};

// On Time Delivery mixed chart (Target line + Achieved bars)
const OnTimeDeliveryBarChart = ({ title, subtitle, labels, actuals, targets, showHeader = true, showAxisLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Percent', isExpanded = false }) => {
  const svgWidth = 900;
  const svgHeight = 300;
  const padding = 85;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...actuals, ...targets, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const groupWidth = plotWidth / labels.length;
  const barWidth = Math.min(28, groupWidth * 0.45);
  const getX = (idx) => {
    const center = padding + idx * groupWidth + groupWidth / 2;
    return center - barWidth / 2;
  };
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;
  const targetPath = targets
    .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx) + barWidth / 2} ${getY(val || 0)}`)
    .join(' ');

  const displayAxisLabels = isExpanded || showAxisLabels;

  return (
    <div className="w-full h-full flex flex-col">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      {showHeader && subtitle && <p className="text-sm text-gray-600 mb-4 text-center">{subtitle}</p>}
      <div className="flex flex-row flex-1 min-h-0 items-center gap-1">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="flex-1 min-w-0 h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="onTimeDeliveryBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
        </defs>

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

        <path d={targetPath} stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {labels.map((label, idx) => (
          <g key={`group-${idx}`}>
            <rect x={getX(idx)} y={getY(actuals[idx] || 0)} width={barWidth} height={getBarHeight(actuals[idx] || 0)} fill="url(#onTimeDeliveryBarGradient)" rx="4" />
            <circle cx={getX(idx) + barWidth / 2} cy={getY(targets[idx] || 0)} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />

            <text x={getX(idx) + barWidth / 2} y={getY(targets[idx] || 0) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#92400e">{Math.round(targets[idx] || 0)}</text>
            <text x={getX(idx) + barWidth / 2} y={getY(actuals[idx] || 0) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">{Math.round(actuals[idx] || 0)}</text>
          </g>
        ))}

        {displayAxisLabels && labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + idx * groupWidth + groupWidth / 2} y={svgHeight - padding + 30} textAnchor="middle" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {displayAxisLabels && (() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString()) + '%';
            return (
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}
        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">{xAxisTitle}</text>
            <text x={22} y={svgHeight / 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" transform={`rotate(-90 22 ${svgHeight / 2})`}>{yAxisTitle}</text>
          </>
        )}
      </svg>

      <div className="flex flex-col justify-center gap-2 pl-2 w-16 flex-shrink-0">
        <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#f59e0b] rounded flex-shrink-0"></span><span className="text-[10px] text-gray-600">Target</span></div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#15803d] rounded flex-shrink-0"></span><span className="text-[10px] text-gray-600">Achieved</span></div>
      </div>
      </div>
    </div>
  );
};

// Theme (Bar chart) component
const Box4ThemeBarChart = ({ title, subtitle, labels, values, showAxisLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Value', showHeader = true, showSubtitle, isExpanded = false }) => {
  const svgWidth = 900;
  const svgHeight = 420;
  const padding = 85;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const barWidth = plotWidth / (values.length * 1.5);
  const getX = (idx) => padding + (idx * plotWidth) / values.length + (plotWidth / values.length / 2 - barWidth / 2);
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;
  const getBarHeight = (val) => ((val - minVal) / (range || 1)) * plotHeight;

  const displayAxisLabels = isExpanded || showAxisLabels;

  return (
    <div className="w-full h-full">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      {(showHeader || showSubtitle) && subtitle && <p className="text-xs font-semibold text-gray-500 mb-1 text-center tracking-wide uppercase">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="themeBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

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
            <rect x={getX(idx)} y={getY(val)} width={barWidth} height={getBarHeight(val)} fill="url(#themeBarGradient)" stroke="white" strokeWidth="1" rx="4" />
            <text x={getX(idx) + barWidth / 2} y={getY(val) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e40af">{Math.round(val)}</text>
          </g>
        ))}

        {displayAxisLabels && labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx * plotWidth) / labels.length + (plotWidth / labels.length / 2)} y={svgHeight - padding + 30} textAnchor="middle" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {displayAxisLabels && (() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString());
            return (
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}

        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">{xAxisTitle}</text>
            <text x={22} y={svgHeight / 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" transform={`rotate(-90 22 ${svgHeight / 2})`}>{yAxisTitle}</text>
          </>
        )}
      </svg>
    </div>
  );
};

// Employees left line chart
const Box4EmployeesLineChart = ({ title, subtitle, labels, values, showAxisLabels = true, showPointLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Count', showHeader = true, showSubtitle, isExpanded = false }) => {
  const svgWidth = 900;
  const svgHeight = 420;
  const padding = 85;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...values, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  const getX = (idx) => padding + (idx / (labels.length - 1 || 1)) * plotWidth;
  const getY = (val) => svgHeight - padding - ((val - minVal) / (range || 1)) * plotHeight;

  const path = values.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');
  const areaPath = values.length > 0 ? (
    `${path} L ${getX(values.length - 1)} ${svgHeight - padding} L ${getX(0)} ${svgHeight - padding} Z`
  ) : '';

  const displayAxisLabels = isExpanded || showAxisLabels;
  const displayPointLabels = isExpanded || showPointLabels;

  return (
    <div className="w-full h-full">
      {showHeader && <h2 className="text-base font-semibold text-gray-800 mb-4 text-center">{title}</h2>}
      {(showHeader || showSubtitle) && subtitle && <p className="text-xs font-semibold text-gray-500 mb-1 text-center tracking-wide uppercase">{subtitle}</p>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto" style={{ maxHeight: isExpanded ? '450px' : '135px' }}>
        <defs>
          <linearGradient id="employeeLineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

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

        {areaPath && <path d={areaPath} fill="url(#employeeLineGradient)" />}
        <path d={path} stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {values.map((val, idx) => (
          <g key={`dot-${idx}`}>
            <circle cx={getX(idx)} cy={getY(val)} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
            {displayPointLabels && <text x={getX(idx)} y={getY(val) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="#991b1b">{Math.round(val)}</text>}
          </g>
        ))}

        {displayAxisLabels && labels.map((label, idx) => (
          <text key={`x-label-${idx}`} x={padding + (idx / (labels.length - 1 || 1)) * plotWidth} y={svgHeight - padding + 30} textAnchor="middle" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
        ))}

        {displayAxisLabels && (() => {
          const ticks = 5;
          const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minVal + (i / ticks) * range);
          const shouldShowDecimals = range < 10;
          return tickValues.map((tick, i) => {
            const ratio = (tick - minVal) / (range || 1);
            const y = svgHeight - padding - ratio * plotHeight;
            const label = (shouldShowDecimals ? tick.toFixed(1) : Math.round(tick).toString());
            return (
              <text key={`y-label-${i}`} x={padding - 12} y={y + 5} textAnchor="end" fontSize="13" fontWeight="500" fill="#4b5563">{label}</text>
            );
          });
        })()}

        {displayAxisLabels && (
          <>
            <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151">{xAxisTitle}</text>
            <text x={22} y={svgHeight / 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" transform={`rotate(-90 22 ${svgHeight / 2})`}>{yAxisTitle}</text>
          </>
        )}
      </svg>
    </div>
  );
};

// Radar chart for pillar overview
const PillarRadarChart = ({ pillars, onPillarClick, compact = false }) => {
  const size = compact ? 280 : 360;
  const center = size / 2;
  const radius = compact ? 95 : 130;
  const ringSteps = 5;

  const normalizedPillars = (pillars || []).map((pillar, index) => {
    const rawValue =
      pillar?.kpi_count ??
      pillar?.kpis_count ??
      pillar?.kpiCount ??
      pillar?.total_kpis ??
      pillar?.kpis?.length ??
      pillar?.count ??
      1;

    return {
      id: pillar?.id,
      name: pillar?.piller_name || pillar?.pillar_name || pillar?.short_name || `Pillar ${index + 1}`,
      shortName: pillar?.short_name || '',
      value: Number(rawValue) || 0,
    };
  });

  const maxValue = Math.max(...normalizedPillars.map((pillar) => pillar.value), 1);
  const angleStep = normalizedPillars.length > 0 ? (Math.PI * 2) / normalizedPillars.length : 0;

  const toPoint = (value, angle) => {
    const scaledRadius = (value / maxValue) * radius;
    return {
      x: center + scaledRadius * Math.sin(angle),
      y: center - scaledRadius * Math.cos(angle),
    };
  };

  const polygonPoints = normalizedPillars.map((pillar, index) => {
    const angle = index * angleStep;
    const point = toPoint(pillar.value, angle);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-slate-200 p-4 ${compact ? 'h-full flex items-center justify-center' : ''}`}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Explore Pillars</h3>
            <p className="text-sm text-gray-500">Radar view of pillar KPIs for the selected financial year</p>
          </div>
        </div>
      )}

      {normalizedPillars.length === 0 ? (
        <div className="py-16 text-center text-gray-500">No pillars available</div>
      ) : compact ? (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[260px]">
            {[...Array(ringSteps)].map((_, ringIndex) => {
              const ringRadius = ((ringIndex + 1) / ringSteps) * radius;
              return (
                <circle
                  key={`ring-${ringIndex}`}
                  cx={center}
                  cy={center}
                  r={ringRadius}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeDasharray="4 4"
                />
              );
            })}

            {[...Array(normalizedPillars.length)].map((_, index) => {
              const angle = index * angleStep;
              const end = toPoint(maxValue, angle);
              return (
                <line
                  key={`axis-${index}`}
                  x1={center}
                  y1={center}
                  x2={end.x}
                  y2={end.y}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
              );
            })}

            <polygon
              points={polygonPoints}
              fill="rgba(59, 130, 246, 0.25)"
              stroke="#2563eb"
              strokeWidth="2.5"
            />

            {normalizedPillars.map((pillar, index) => {
              const angle = index * angleStep;
              const point = toPoint(pillar.value, angle);
              return (
                <g key={pillar.id || pillar.name}>
                  <circle cx={point.x} cy={point.y} r="4" fill="#2563eb" stroke="white" strokeWidth="1.5" />
                </g>
              );
            })}

            <circle cx={center} cy={center} r="3" fill="#2563eb" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
          <div className="w-full lg:w-[420px] flex justify-center">
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[360px] h-auto">
              {[...Array(ringSteps)].map((_, ringIndex) => {
                const ringRadius = ((ringIndex + 1) / ringSteps) * radius;
                return (
                  <circle
                    key={`ring-${ringIndex}`}
                    cx={center}
                    cy={center}
                    r={ringRadius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {[...Array(normalizedPillars.length)].map((_, index) => {
                const angle = index * angleStep;
                const end = toPoint(maxValue, angle);
                return (
                  <line
                    key={`axis-${index}`}
                    x1={center}
                    y1={center}
                    x2={end.x}
                    y2={end.y}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                );
              })}

              <polygon
                points={polygonPoints}
                fill="rgba(59, 130, 246, 0.25)"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {normalizedPillars.map((pillar, index) => {
                const angle = index * angleStep;
                const point = toPoint(pillar.value, angle);
                const labelRadius = radius + 22;
                const labelPoint = toPoint(maxValue, angle);
                const labelX = center + labelRadius * Math.sin(angle);
                const labelY = center - labelRadius * Math.cos(angle);

                return (
                  <g key={pillar.id || pillar.name}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#2563eb" stroke="white" strokeWidth="2" />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#1e3a8a"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onPillarClick?.(pillar)}
                    >
                      {pillar.shortName || pillar.name}
                    </text>
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      {pillar.value}
                    </text>
                  </g>
                );
              })}

              <circle cx={center} cy={center} r="3" fill="#2563eb" />
            </svg>
          </div>

          <div className="flex-1 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {normalizedPillars.map((pillar) => (
                <button
                  key={pillar.id || pillar.name}
                  type="button"
                  onClick={() => onPillarClick?.(pillar)}
                  className="text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{pillar.name}</div>
                      {pillar.shortName && <div className="text-xs text-slate-500">{pillar.shortName}</div>}
                    </div>
                    <div className="text-lg font-bold text-blue-700">{pillar.value}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get current fiscal year (April to March)
const getCurrentFiscalYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  // If current month is Jan-Mar (0-2), fiscal year started last year
  return currentMonth < 3 ? currentYear - 1 : currentYear;
};

// Helper to parse fiscal year from strings like "2025", "2025-2026", "2025/2026"
const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : parseInt(value, 10);
  }
  return null;
};

// Helper function to compare fiscal years (handles multiple formats)
const isFiscalYearMatch = (kpiFiscalYear, selectedFiscalYear) => {
  const kpiYear = parseFiscalYear(kpiFiscalYear);
  return kpiYear === selectedFiscalYear;
};

const normalizeText = (value) => (value || '').toString().trim().toLowerCase();
const normalizeValueType = (valueType) => {
  const normalized = (valueType || '').toString().trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'actual' || normalized === 'achieved') return 'actual';
  if (normalized === 'target') return 'target';
  if (normalized.includes('actual') || normalized.includes('achieved')) return 'actual';
  if (normalized.includes('target')) return 'target';
  return normalized;
};
const parseNumeric = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [salesDisplayYear, setSalesDisplayYear] = useState('');
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
  const [kpiIdMap, setKpiIdMap] = useState({});
  const navigate = useNavigate();
  
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [cachedKpiValues, setCachedKpiValues] = useState([]);
  
  // Computed fiscal month sequence based on selected year
  const FISCAL_MONTH_SEQUENCE = useMemo(() => getFiscalMonthSequence(selectedFiscalYear), [selectedFiscalYear]);

  const getKpisForFiscalYear = async () => {
    const kpisRes = await api.get('/kpis');
    const allKpis = kpisRes.data?.data || [];
    return allKpis.filter(k => isFiscalYearMatch(k.fin_year, selectedFiscalYear));
  };

  const getKpiValuesForFiscalYear = async () => {
    const fiscalKpis = await getKpisForFiscalYear();
    if (!fiscalKpis.length) {
      return [];
    }

    const valueResponses = await Promise.allSettled(
      fiscalKpis.map(kpi => api.get(`/kpi-values/kpi/${kpi.id}`))
    );

    const allValues = valueResponses
      .filter(res => res.status === 'fulfilled')
      .flatMap(res => res.value?.data?.data || [])
      .filter(Boolean);
    
    return allValues;
  };

  const findKpiValueByData = (values, matchers) => {
    const checks = Array.isArray(matchers) ? matchers : [matchers];
    const found = values.find(value => {
      const dataText = normalizeText(value?.data);
      const matches = checks.some(check => check(dataText));
      return matches;
    });
    
    return found;
  };

  // Adjust selected fiscal year if outside available range
  useEffect(() => {
    if (availableFiscalYears.length > 0 && !availableFiscalYears.includes(selectedFiscalYear)) {
      // Find closest available year
      const closest = availableFiscalYears.reduce((prev, curr) => 
        Math.abs(curr - selectedFiscalYear) < Math.abs(prev - selectedFiscalYear) ? curr : prev
      );
      setSelectedFiscalYear(closest);
    }
  }, [availableFiscalYears, selectedFiscalYear]);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        await fetchStatistics();
        
        // Fetch KPI values once for all charts to avoid multiple redundant API calls
        const fiscalValues = await getKpiValuesForFiscalYear();
        setCachedKpiValues(fiscalValues);
        
        // Pass cached values to all chart functions with individual error handling
        const chartResults = await Promise.allSettled([
          loadIndustry40Chart(fiscalValues),
          loadZeroQualityChart(fiscalValues),
          loadSalesChart(fiscalValues),
          loadProfitabilityData(fiscalValues),
          loadPlantEfficiency(fiscalValues),
          loadGreenFactoryChart(fiscalValues),
          loadZeroAccidentsChart(fiscalValues),
          loadOnTimeDeliveryChart(fiscalValues),
          loadThemeChart(fiscalValues),
          loadEmployeesChart(fiscalValues)
        ]);
        
        // Log any failures
        chartResults.forEach((result, index) => {
          const chartNames = ['Industry40', 'ZeroQuality', 'Sales', 'Profitability', 'PlantEfficiency', 'GreenFactory', 'ZeroAccidents', 'OnTimeDelivery', 'Theme', 'Employees'];
          if (result.status === 'rejected') {
            console.error(`Failed to load ${chartNames[index]} chart:`, result.reason);
          }
        });
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };
    
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiscalYear]);

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
        const allKpis = Array.isArray(kpisData) ? kpisData : (Array.isArray(kpisData?.data) ? kpisData.data : []);
        
        // console.log('All KPIs:', allKpis.length, 'Selected Fiscal Year:', selectedFiscalYear);
        // console.log('Sample KPIs fin_year values:', allKpis.slice(0, 5).map(k => ({ title: k.title, fin_year: k.fin_year, type: typeof k.fin_year })));
        
        // Extract unique available fiscal years from ALL KPIs
        const fiscalYears = allKpis
          .map(kpi => parseFiscalYear(kpi.fin_year))
          .filter(year => year != null && !isNaN(year) && year > 0);
        
        if (fiscalYears.length > 0) {
          const uniqueYears = [...new Set(fiscalYears)].sort((a, b) => a - b);
          //console.log('Available fiscal years:', uniqueYears);
          setAvailableFiscalYears(uniqueYears);
        }

        // Filter KPIs by selected fiscal year - handle both string and number comparison
        const kpis = allKpis.filter(kpi => isFiscalYearMatch(kpi.fin_year, selectedFiscalYear));
        
        //console.log('Filtered KPIs for fiscal year', selectedFiscalYear, ':', kpis.length);
        
        setKpiStats({
          total: kpis.length
        });

        // Build KPI ID map for navigation
        const idMap = {};
        kpis.forEach((kpi) => {
          // Map common chart titles to KPI IDs
          const titleLower = kpi.title?.toLowerCase() || '';
          if (titleLower.includes('industry') || titleLower.includes('4.0')) {
            idMap['Industry 4.0'] = kpi.id;
          }
          if (titleLower.includes('green') || titleLower.includes('factory')) {
            idMap['Green Factory'] = kpi.id;
          }
          if (titleLower.includes('zero') || titleLower.includes('accident') || titleLower.includes('safety')) {
            idMap['Zero Accidents'] = kpi.id;
          }
          if (titleLower.includes('quality')) {
            idMap['Zero Quality'] = kpi.id;
          }
          if (titleLower.includes('delivery') || titleLower.includes('on time') || titleLower.includes('otd')) {
            idMap['On Time Delivery'] = kpi.id;
          }
          if (titleLower.includes('plant') || titleLower.includes('efficiency') || titleLower.includes('ope')) {
            idMap['Plant Efficiency'] = kpi.id;
          }
          if (titleLower.includes('cost')) {
            idMap['Cost'] = kpi.id;
          }
          if (titleLower.includes('revenue') || titleLower.includes('sales')) {
            idMap['Revenue'] = kpi.id;
          }
          if (titleLower.includes('profit') || titleLower.includes('p & l') || titleLower.includes('p&l')) {
            idMap['Profitability'] = kpi.id;
          }
          if (titleLower.includes('morale') || titleLower.includes('theme') || titleLower.includes('attrition') || titleLower.includes('employee')) {
            idMap['Morale'] = kpi.id;
          }
          idMap[kpi.title] = kpi.id; // Also map by exact title
        });
        setKpiIdMap(idMap);
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
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGreenFactoryChart = async (fiscalValues) => {
    try {
      setGreenFactoryLoading(true);
      console.log(`📊 Loading Green Factory Chart for Fiscal Year: ${selectedFiscalYear}`);
      
      // Match "GREEN FACTORY" exactly
      const greenFactoryValue = findKpiValueByData(
        fiscalValues,
        (text) => text === 'green factory'
      );
      
      if (!greenFactoryValue) {
        console.warn('KPI value not found for GREEN FACTORY');
        setGreenFactoryChart(null);
        return;
      }

      const valuesByMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Green Factory data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${greenFactoryValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }
          const value = actualRow ? parseNumeric(actualRow.value) : 0;
          console.log(`    ✅ Green Factory data: month=${month}, year=${year}, value=${value}`);
          valuesByMonth.push(value);
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          valuesByMonth.push(0);
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const values = valuesByMonth.slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setGreenFactoryChart({ title: `Environment (${displayYear})`, subtitle: 'Green Factory', labels, values });
    } catch (err) {
      //console.error('Failed to load Green Factory chart', err);
      setGreenFactoryChart(null);
    } finally {
      setGreenFactoryLoading(false);
    }
  };

  const loadZeroAccidentsChart = async (fiscalValues) => {
    try {
      setZeroAccidentsLoading(true);
      console.log(`📊 Loading Zero Accidents Chart for Fiscal Year: ${selectedFiscalYear}`);
      
      // Match "ZERO ACCIDENTS" exactly
      const zeroAccidentsValue = findKpiValueByData(
        fiscalValues,
        (text) => text === 'zero accidents'
      );
      
      if (!zeroAccidentsValue) {
        console.warn('KPI value not found for ZERO ACCIDENTS');
        setZeroAccidentsChart(null);
        return;
      }

      const byMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Zero Accidents data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${zeroAccidentsValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }
          const actual = actualRow ? parseNumeric(actualRow.value) : 0;
          const target = targetRow ? parseNumeric(targetRow.value) : 0;
          console.log(`    ✅ Zero Accidents data: month=${month}, year=${year}, actual=${actual}, target=${target}`);
          byMonth.push({ actual, target });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const actuals = byMonth.map(d => d.actual).slice(0, sliceEnd);
      const targets = byMonth.map(d => d.target).slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setZeroAccidentsChart({ title: `Safety (${displayYear})`, subtitle: 'Zero Accidents', labels, actuals, targets });
    } catch (err) {
      console.error('Failed to load Zero Accidents chart', err);
      setZeroAccidentsChart(null);
    } finally {
      setZeroAccidentsLoading(false);
    }
  };

  const loadOnTimeDeliveryChart = async (fiscalValues) => {
    try {
      setOnTimeDeliveryLoading(true);
      console.log(`📊 Loading On Time Delivery Chart for Fiscal Year: ${selectedFiscalYear}`);
      
      // Match "ON TIME DELIVERY" exactly
      const onTimeDeliveryValue = findKpiValueByData(
        fiscalValues,
        (text) => text === 'on time delivery'
      );
      
      if (!onTimeDeliveryValue) {
        console.warn('KPI value not found for ON TIME DELIVERY');
        setOnTimeDeliveryChart(null);
        return;
      }

      const byMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching On Time Delivery data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${onTimeDeliveryValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }
          const actual = actualRow ? parseNumeric(actualRow.value) : 0;
          const target = targetRow ? parseNumeric(targetRow.value) : 0;
          console.log(`    ✅ On Time Delivery data: month=${month}, year=${year}, actual=${actual}, target=${target}`);
          byMonth.push({ actual, target });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err.message);
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const actuals = byMonth.map(d => d.actual).slice(0, sliceEnd);
      const targets = byMonth.map(d => d.target).slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;

      setOnTimeDeliveryChart({ title: `On Time Delivery (${displayYear})`, subtitle: 'Target vs Achieved', labels, actuals, targets });
    } catch (err) {
      //console.error('Failed to load On Time Delivery chart', err);
      setOnTimeDeliveryChart(null);
    } finally {
      setOnTimeDeliveryLoading(false);
    }
  };

  const loadThemeChart = async (fiscalValues) => {
    try {
      setThemeChartLoading(true);
      console.log(`📊 Loading Theme Chart for Fiscal Year: ${selectedFiscalYear}`);
      
      // Match "THEME OF THE YEAR 2025-26 - UNLOCK THE POWER OF "YOU"" exactly
      const themeValue = findKpiValueByData(
        fiscalValues,
        (text) => text.includes('theme of the year') && text.includes('unlock the power of')
      );
      
      if (!themeValue) {
        console.warn('KPI value not found for THEME OF THE YEAR');
        setThemeChart(null);
        return;
      }

      const themeByMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Theme data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${themeValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }
          const value = actualRow ? parseNumeric(actualRow.value) : 0;
          console.log(`    ✅ Theme data: month=${month}, year=${year}, value=${value}`);
          themeByMonth.push(value);
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          themeByMonth.push(0);
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setThemeChart({ title: `Theme Of The Year ${displayYear}`, subtitle: 'Unlock The Power of You', labels, values: themeByMonth.slice(0, sliceEnd) });
    } catch (err) {
      //console.error('Failed to load Theme chart', err);
      setThemeChart(null);
    } finally { setThemeChartLoading(false); }
  };

  const loadEmployeesChart = async (fiscalValues) => {
    try {
      setEmployeesChartLoading(true);
      console.log(`📊 Loading Employees Chart for Fiscal Year: ${selectedFiscalYear}`);
      
      // Match "NO. OF EMPLOYEES WHO LEFT" exactly
      const employeesValue = findKpiValueByData(
        fiscalValues,
        (text) => text === 'no. of employees who left'
      );
      
      if (!employeesValue) {
        console.warn('KPI value not found for NO. OF EMPLOYEES WHO LEFT');
        setEmployeesChart(null);
        return;
      }

      const employeesByMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Employees data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${employeesValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }
          const value = actualRow ? parseNumeric(actualRow.value) : 0;
          console.log(`    ✅ Employees data: month=${month}, year=${year}, value=${value}`);
          employeesByMonth.push(value);
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          employeesByMonth.push(0);
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      setEmployeesChart({ title: 'No. of Employees Who Left', subtitle: 'Monthly Attrition', labels, values: employeesByMonth.slice(0, sliceEnd) });
    } catch (err) {
      console.error('Failed to load Employees chart', err);
      setEmployeesChart(null);
    } finally { setEmployeesChartLoading(false); }
  };

  const loadPlantEfficiency = async (fiscalValues) => {
    try {
      setEfficiencyLoading(true);
      
      // Debug: log all KPI values to find the exact OPE data field
      //console.log('All fiscal KPI values:', fiscalValues.map(v => ({ id: v.id, data: v.data })));
      
      // Match "OVERALL PLANT EFFICIENCY (OPE)" exactly
      const opeValue = findKpiValueByData(
        fiscalValues,
        (text) => text === 'overall plant efficiency (ope)'
      );

      //console.log('OPE KPI Value found:', opeValue);

      if (!opeValue) {
        //console.warn('OPE KPI value not found. Available:', fiscalValues.map(v => v.data));
        setMonthlyEfficiency([]);
        setSelectedFiscalIndex(0);
        return;
      }

      const efficiencyByIndex = {};
      let lastAvailableIdx = -1;

      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          const resp = await api.get(`/kpi-data-values/${opeValue.id}/monthly`, {
            params: { year }
          });
          const rows = resp.data?.data || [];
          //console.log(`Month ${month}/${year} - Data rows:`, rows);
          const monthRows = rows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow || targetRow) {
            lastAvailableIdx = idx;
          }
          //console.log(`Month ${month}/${year} - Target:`, targetRow, 'Actual:', actualRow);
          
          const target = targetRow ? parseNumeric(targetRow.value) : 0;
          const actual = actualRow ? parseNumeric(actualRow.value) : 0;
          // If target is missing, assume actual is already a percent value.
          const efficiency = target > 0 ? Math.min(100, (actual / target) * 100) : Math.min(100, actual);
          efficiencyByIndex[idx] = Math.round(efficiency * 10) / 10;
          //console.log(`Month ${month}/${year} - Efficiency calculated: ${efficiencyByIndex[idx]}% (actual: ${actual}, target: ${target})`);
        } catch (err) {
          //console.warn(`Failed to load efficiency for month ${month}, year ${year}:`, err);
          efficiencyByIndex[idx] = 0;
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const monthly = FISCAL_MONTH_SEQUENCE.map((entry, idx) => ({
        month: entry.month,
        year: entry.year,
        efficiency: efficiencyByIndex[idx] || 0,
      })).slice(0, sliceEnd);

      setMonthlyEfficiency(monthly);
      setSelectedFiscalIndex(0);
    } catch (err) {
      //console.error('Failed to load plant efficiency', err);
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

  const CHART_KEYS = [
    'plantEfficiency',
    'industry40',
    'zeroQuality',
    'salesProfit',
    'onTimeDelivery',
    'zeroAccidents',
    'greenFactory',
    'themeEmployees'
  ];

  const getChartData = (key) => {
    switch (key) {
      case 'plantEfficiency':
        return { monthlyEfficiency, selectedFiscalIndex };
      case 'industry40':
        return industry40Chart || {
          title: 'Industry 4.0 Performance',
          labels: MONTH_LABELS,
          actuals: Array(12).fill(0),
          targets: Array(12).fill(0)
        };
      case 'zeroQuality':
        return zeroQualityChart || {
          title: 'Zero Quality Complaints',
          labels: MONTH_LABELS,
          actuals: Array(12).fill(0),
          targets: Array(12).fill(0)
        };
      case 'salesProfit':
        return { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex };
      case 'onTimeDelivery':
        return onTimeDeliveryChart || {
          title: 'On Time Delivery',
          subtitle: 'Target vs Achieved',
          labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
          actuals: Array(12).fill(0),
          targets: Array(12).fill(0)
        };
      case 'zeroAccidents':
        return zeroAccidentsChart || {
          title: 'Safety',
          subtitle: 'Zero Accidents',
          labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
          actuals: Array(12).fill(0),
          targets: Array(12).fill(0)
        };
      case 'greenFactory':
        return greenFactoryChart || {
          title: 'Environment',
          subtitle: 'Green Factory',
          labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
          values: Array(12).fill(0)
        };
      case 'themeEmployees':
        return {
          themeChart: themeChart || {
            title: 'Theme Of The Year',
            subtitle: 'Unlock The Power of You',
            labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
            values: Array(12).fill(0)
          },
          employeesChart: employeesChart || {
            title: 'No. of Employees Who Left',
            subtitle: 'Monthly Attrition',
            labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
            values: Array(12).fill(0)
          }
        };
      default:
        return null;
    }
  };

  const navigateChart = (direction) => {
    const currentIndex = CHART_KEYS.indexOf(expandedChart);
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % CHART_KEYS.length;
    } else {
      nextIndex = (currentIndex - 1 + CHART_KEYS.length) % CHART_KEYS.length;
    }
    
    const nextKey = CHART_KEYS[nextIndex];
    setExpandedChart(nextKey);
    setExpandedChartData(getChartData(nextKey));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!expandedChart) return;
      if (e.key === 'ArrowLeft') {
        navigateChart('prev');
      } else if (e.key === 'ArrowRight') {
        navigateChart('next');
      } else if (e.key === 'Escape') {
        closeExpandedChart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedChart, monthlyEfficiency, selectedFiscalIndex, industry40Chart, zeroQualityChart, monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex, onTimeDeliveryChart, zeroAccidentsChart, greenFactoryChart, themeChart, employeesChart]);

  const handleKPITitleClick = async (chartTitle) => {
    let kpiId = kpiIdMap[chartTitle];
    if (!kpiId) {
      console.log(`[handleKPITitleClick] Fallback lookup for title: ${chartTitle}`);
      try {
        const fiscalKpis = await getKpisForFiscalYear();
        const titleLower = chartTitle.toLowerCase();
        
        let matchedKpi = fiscalKpis.find(k => {
          const kTitle = (k.title || '').toLowerCase();
          return kTitle === titleLower;
        });

        if (!matchedKpi) {
          // Rule-based fallback matching
          matchedKpi = fiscalKpis.find(k => {
            const kTitle = (k.title || '').toLowerCase();
            if (titleLower === 'industry 4.0' && (kTitle.includes('industry') || kTitle.includes('4.0'))) return true;
            if (titleLower === 'green factory' && (kTitle.includes('green') || kTitle.includes('factory'))) return true;
            if (titleLower === 'zero accidents' && (kTitle.includes('zero accident') || kTitle.includes('accident') || kTitle.includes('safety'))) return true;
            if (titleLower === 'zero quality' && kTitle.includes('quality')) return true;
            if (titleLower === 'on time delivery' && (kTitle.includes('delivery') || kTitle.includes('on time') || kTitle.includes('otd'))) return true;
            if (titleLower === 'plant efficiency' && (kTitle.includes('plant') || kTitle.includes('efficiency') || kTitle.includes('ope'))) return true;
            if (titleLower === 'cost' && kTitle.includes('cost') && !kTitle.includes('revenue') && !kTitle.includes('sales') && !kTitle.includes('profit')) return true;
            if (titleLower === 'revenue' && (kTitle.includes('revenue') || kTitle.includes('sales'))) return true;
            if (titleLower === 'profitability' && (kTitle.includes('profit') || kTitle.includes('p & l') || kTitle.includes('p&l'))) return true;
            if (titleLower === 'morale' && (kTitle.includes('morale') || kTitle.includes('theme') || kTitle.includes('attrition') || kTitle.includes('employee'))) return true;
            return false;
          });
        }

        if (matchedKpi) {
          kpiId = matchedKpi.id;
        }
      } catch (err) {
        console.error('Error during fallback KPI lookup:', err);
      }
    }

    if (kpiId) {
      navigate(`/management/kpi/${kpiId}`, { 
        state: { fiscalYear: selectedFiscalYear } 
      });
    } else {
      console.warn(`No KPI ID found for chart title: ${chartTitle}`);
    }
  };

  const loadIndustry40Chart = async (fiscalValues) => {
    try {
      setIndustry40Loading(true);
      console.log(`📊 Loading Industry 4.0 Chart for Fiscal Year: ${selectedFiscalYear}`);

      const industry40Value = findKpiValueByData(fiscalValues, (text) =>
        text.includes('industry 4.0') || text.includes('industry4.0') || text.includes('industry4')
      );
      
      if (!industry40Value) {
        console.warn('KPI value not found for Industry 4.0');
        setIndustry40Chart(null);
        return;
      }

      // Fetch data using fiscal month sequence
      const byMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Industry 4.0 data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${industry40Value.id}/monthly`, {
            params: { year }
          });
          const allRows = resp.data?.data || [];

          // API returns multiple rows per month with value_type: 'Target' or 'Achieved'
          const monthRows = allRows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }

          const actualValue = actualRow ? parseNumeric(actualRow.value) : 0;
          const targetValue = targetRow ? parseNumeric(targetRow.value) : 0;
          console.log(`    ✅ Industry 4.0 data: month=${month}, year=${year}, actual=${actualValue}, target=${targetValue}`);
          
          byMonth.push({ 
            actual: actualValue, 
            target: targetValue 
          });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const actuals = byMonth.map(d => d.actual).slice(0, sliceEnd);
      const targets = byMonth.map(d => d.target).slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;

      const chartData = {
        title: `Industry 4.0 Performance Trend (${displayYear})`,
        labels,
        actuals,
        targets,
      };
      setIndustry40Chart(chartData);
    } catch (err) {
      console.error('Failed to load Industry 4.0 chart', err);
      setIndustry40Chart(null);
    } finally {
      setIndustry40Loading(false);
    }
  };

  const loadZeroQualityChart = async (fiscalValues) => {
    try {
      setZeroQualityLoading(true);
      console.log(`📊 Loading Zero Quality Chart for Fiscal Year: ${selectedFiscalYear}`);

      const qualityValue = findKpiValueByData(fiscalValues, (text) =>
        text.includes('zero quality') || (text.includes('quality') && text.includes('complaint'))
      );
      
      if (!qualityValue) {
        console.warn('KPI value not found for ZERO QUALITY COMPLAINTS FROM CUSTOMERS');
        setZeroQualityChart(null);
        return;
      }

      // Fetch data using fiscal month sequence
      const byMonth = [];
      let lastAvailableIdx = -1;
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Zero Quality data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${qualityValue.id}/monthly`, {
            params: { year }
          });
          const allRows = resp.data?.data || [];

          // API returns multiple rows per month with value_type: 'Target' or 'Achieved'
          const monthRows = allRows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }

          const actualValue = actualRow ? parseNumeric(actualRow.value) : 0;
          const targetValue = targetRow ? parseNumeric(targetRow.value) : 0;
          console.log(`    ✅ Zero Quality data: month=${month}, year=${year}, actual=${actualValue}, target=${targetValue}`);
          
          byMonth.push({ 
            actual: actualValue, 
            target: targetValue 
          });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          byMonth.push({ actual: 0, target: 0 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const labels = FISCAL_MONTH_SEQUENCE.map(entry => MONTH_LABELS[entry.month - 1]).slice(0, sliceEnd);
      const actuals = byMonth.map(d => d.actual).slice(0, sliceEnd);
      const targets = byMonth.map(d => d.target).slice(0, sliceEnd);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;

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

  const loadSalesChart = async (fiscalValues) => {
    try {
      setSalesLoading(true);
      console.log(`📊 Loading Sales Chart for Fiscal Year: ${selectedFiscalYear} (${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year})`);

      const fiscalKpis = await getKpisForFiscalYear();
      const salesKpi = fiscalKpis.find((kpi) => normalizeText(kpi?.title) === 'sales');

      if (!salesKpi) {
        console.warn('KPI not found for Sales (title "sales")');
        setMonthlySalesData([]);
        return;
      }

      const salesValuesResponse = await api.get(`/kpi-values/kpi/${salesKpi.id}`);
      const salesValues = salesValuesResponse?.data?.data || [];
      const salesValue = salesValues.find((value) => normalizeText(value?.data) === 'sales');

      if (!salesValue) {
        console.warn('KPI value not found for SALES');
        setMonthlySalesData([]);
        return;
      }

      const salesByMonth = [];
      let lastAvailableIdx = -1;
      
      // Fetch all data for the KPI value for this fiscal year
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Sales data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${salesValue.id}/monthly`, {
            params: { year }
          });
          const allRows = resp.data?.data || [];

          // API returns multiple rows per month with value_type: 'Target' or 'Achieved'
          const monthRows = allRows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }

          const actualValue = actualRow ? parseNumeric(actualRow.value) : 0;
          const targetValue = targetRow ? parseNumeric(targetRow.value) : 0;
          
          console.log(`    ✅ Sales data: month=${month}, year=${year}, actual=${actualValue}, target=${targetValue}`);
          
          salesByMonth.push({ 
            month, 
            year, 
            actual: actualValue,  // actual value
            target: targetValue   // target value
          });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          salesByMonth.push({ month, year, actual: 0, target: 0 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const slicedSales = salesByMonth.slice(0, sliceEnd);
      setMonthlySalesData(slicedSales);
      const displayYear = `${FISCAL_MONTH_SEQUENCE[0].year}-${FISCAL_MONTH_SEQUENCE[FISCAL_MONTH_SEQUENCE.length - 1].year}`;
      setSalesDisplayYear(displayYear);
      setSelectedSalesIndex(0);
    } catch (err) {
      console.error('Failed to load Sales data', err);
      setMonthlySalesData([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadProfitabilityData = async (fiscalValues) => {
    try {
      setProfitabilityLoading(true);
      console.log(`📊 Loading Profitability Chart for Fiscal Year: ${selectedFiscalYear}`);

      const profitValue = findKpiValueByData(fiscalValues, (text) =>
        text.includes('profit') || text.includes('p & l') || text.includes('p&l')
      );
      
      if (!profitValue) {
        console.warn('KPI value not found for PROFITABILITY AS PER LATEST P & L STATEMENT');
        setMonthlyProfitData([]);
        return;
      }

      const profitByMonth = [];
      let lastAvailableIdx = -1;
      
      // Fetch all data for the KPI value for this fiscal year
      for (let idx = 0; idx < FISCAL_MONTH_SEQUENCE.length; idx++) {
        const { month, year } = FISCAL_MONTH_SEQUENCE[idx];
        try {
          console.log(`  📅 Fetching Profitability data for month ${month}, year ${year} (Fiscal Year ${selectedFiscalYear})`);
          const resp = await api.get(`/kpi-data-values/${profitValue.id}/monthly`, {
            params: { year }
          });
          const allRows = resp.data?.data || [];

          // API returns multiple rows per month with value_type: 'Target' or 'Achieved'
          const monthRows = allRows.filter(r => Number(r.month) === month && Number(r.year) === year);
          const targetRow = monthRows.find(r => normalizeValueType(r.value_type) === 'target');
          const actualRow = monthRows.find(r => normalizeValueType(r.value_type) === 'actual');
          if (actualRow) {
            lastAvailableIdx = idx;
          }

          const actualValue = actualRow ? parseNumeric(actualRow.value) : 0;
          const targetValue = targetRow ? parseNumeric(targetRow.value) : 100;
          console.log(`    ✅ Profitability data: month=${month}, year=${year}, profit=${actualValue}, target=${targetValue}`);
          
          profitByMonth.push({ 
            month, 
            year, 
            profit: actualValue,  // actual value
            target: targetValue   // target value
          });
        } catch (err) {
          console.warn(`Failed to load data for month ${month}, year ${year}:`, err);
          profitByMonth.push({ month, year, profit: 0, target: 100 });
        }
      }

      const sliceEnd = lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 12;
      const slicedProfit = profitByMonth.slice(0, sliceEnd);
      setMonthlyProfitData(slicedProfit);
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
      <div className="mb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">
              KMI/Global Objectives
            </h1>
            {/* <p className="text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </p> */}
          </div>
          
          {/* Compact Fiscal Year Selector */}
          <div className="flex items-center gap-1 bg-white rounded shadow px-2 py-1 border border-gray-200 h-9 min-h-0">
            <button
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex > 0) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
              className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Fiscal Year"
              style={{lineHeight: '1'}}
            >
              ‹
            </button>
            <span className="text-xs text-gray-500 font-medium mr-1">FY</span>
            <span className="text-sm font-bold text-gray-800 mr-1">
              {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
            </span>
            <span className="text-xs text-gray-400 mr-1">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
            {availableFiscalYears.length > 0 && (
              <span className="text-xs text-gray-400 mr-1">
                ({availableFiscalYears.indexOf(selectedFiscalYear) + 1} / {availableFiscalYears.length})
              </span>
            )}
            <button
              onClick={() => {
                const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                if (currentIndex >= 0 && currentIndex < availableFiscalYears.length - 1) {
                  setSelectedFiscalYear(availableFiscalYears[currentIndex + 1]);
                }
              }}
              disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) >= availableFiscalYears.length - 1}
              className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Fiscal Year"
              style={{lineHeight: '1'}}
            >
              ›
            </button>
          </div>
          {/* Fiscal Year Selector end */}
        </div>
      </div>

      {/* Performance Dashboard Section */}
      <div className="mt-1">
        {/* <h2 className="text-2xl text-center justify-center font-bold text-gray-800 mb-6">📊 Performance Dashboard</h2> */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3 gap-2 lg:h-[calc(110vh-120px)] overflow-hidden">
          {/* Plant Efficiency Speedometer */}
          <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              type="button"
              onClick={() => handleKPITitleClick('Plant Efficiency')}
              className="w-full mb-1 px-2 sm:px-2 md:px-3 py-1 text-xs sm:text-sm lg:text-sm font-semibold leading-snug text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
              title="Go to Plant Efficiency KPI"
            >
              ⚡ Plant Efficiency
            </button>
            {efficiencyLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : (
              <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-4 relative w-full min-w-0 flex-1 min-h-0 overflow-hidden">
                {/* Previous Month Button */}
                <button 
                  type="button"
                  className="bg-gray-100 border border-gray-300 rounded-full w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-sm sm:text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 relative z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!monthlyEfficiency.length) return;
                    setSelectedFiscalIndex(selectedFiscalIndex === 0 ? monthlyEfficiency.length - 1 : selectedFiscalIndex - 1);
                  }}
                  disabled={monthlyEfficiency.length <= 1}
                  title="Previous Month"
                >
                  ‹
                </button>
                
                {/* Speedometer Gauge - Click to Open Modal */}
                <div 
                  className="flex-1 min-w-0 flex flex-col justify-center items-center cursor-pointer hover:opacity-80 transition-opacity h-full min-h-0"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (e.target.closest('button')) return;
                    openExpandedChart('plantEfficiency', { monthlyEfficiency, selectedFiscalIndex });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.target.closest('button')) {
                      openExpandedChart('plantEfficiency', { monthlyEfficiency, selectedFiscalIndex });
                    }
                  }}
                >
                  <SpeedometerGauge 
                    efficiency={monthlyEfficiency[selectedFiscalIndex]?.efficiency || 0}
                    month={MONTH_LABELS[(monthlyEfficiency[selectedFiscalIndex]?.month || 1) - 1]}
                    year={monthlyEfficiency[selectedFiscalIndex]?.year || ''}
                  />
                </div>

                {/* Next Month Button */}
                <button 
                  type="button"
                  className="bg-gray-100 border border-gray-300 rounded-full w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center cursor-pointer text-sm sm:text-xl md:text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 relative z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!monthlyEfficiency.length) return;
                    setSelectedFiscalIndex(selectedFiscalIndex === monthlyEfficiency.length - 1 ? 0 : selectedFiscalIndex + 1);
                  }}
                  disabled={monthlyEfficiency.length <= 1}
                  title="Next Month"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Industry 4.0 Chart */}
        <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              onClick={() => handleKPITitleClick('Industry 4.0')}
              className="w-full mb-2 px-2 sm:px-2 md:px-3 py-1 text-xs sm:text-sm lg:text-sm font-semibold leading-snug text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
            >
              🏭 Industry 4.0
            </button>
            {industry40Loading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : industry40Chart ? (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('industry40', industry40Chart)}
                onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('industry40', industry40Chart)}
              >
              <Industry40LineChart
                title={industry40Chart.title}
                labels={industry40Chart.labels}
                actuals={industry40Chart.actuals}
                targets={industry40Chart.targets}
                showHeader={false}
              />
              </div>
            ) : (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('industry40', { title: 'Industry 4.0 Performance', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
                onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('industry40', { title: 'Industry 4.0 Performance', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
              >
              <Industry40LineChart
                title="Industry 4.0 Performance"
                labels={MONTH_LABELS}
                actuals={Array(12).fill(0)}
                targets={Array(12).fill(0)}
                showHeader={false}
              />
              </div>
            )}
          </div>
        </div>

        {/* Zero Quality Complaints Chart */}
        <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              onClick={() => handleKPITitleClick('Zero Quality')}
              className="w-full mb-2 px-2 sm:px-2 md:px-3 py-1 text-xs sm:text-sm lg:text-sm font-semibold leading-snug text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
            >
              ✅ Zero Quality Complaints
            </button>
            {zeroQualityLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
            ) : zeroQualityChart ? (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('zeroQuality', zeroQualityChart)}
                onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('zeroQuality', zeroQualityChart)}
              >
              <Industry40LineChart
                title={zeroQualityChart.title}
                labels={zeroQualityChart.labels}
                actuals={zeroQualityChart.actuals}
                targets={zeroQualityChart.targets}
                showHeader={false}
              />
              </div>
            ) : (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('zeroQuality', { title: 'Zero Quality Complaints', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
                onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('zeroQuality', { title: 'Zero Quality Complaints', labels: MONTH_LABELS, actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
              >
              <Industry40LineChart
                title="Zero Quality Complaints"
                labels={MONTH_LABELS}
                actuals={Array(12).fill(0)}
                targets={Array(12).fill(0)}
                showHeader={false}
              />
              </div>
            )}
          </div>
        </div>

        {/* Revenue and Profitability Split Chart */}
        <div className="w-full h-full min-h-0 lg:col-span-6 lg:row-span-1">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 h-full min-h-0 flex flex-col p-2 overflow-hidden">
            {/* Group Title */}
            <button
              onClick={() => handleKPITitleClick('Cost')}
              className="w-full mb-1 px-2 sm:px-2 md:px-3 py-1 text-xs sm:text-sm lg:text-sm font-semibold leading-snug text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-normal break-words"
            >
              💰 Cost
            </button>
            <div className="flex flex-col md:flex-row h-full flex-1">
            {/* Revenue Section */}
            <div className="flex-1 px-2 pb-2 pt-1 md:px-4 md:pb-4 md:pt-1 flex flex-col md:border-r border-gray-200 min-w-0 justify-center h-full">
              <button 
                onClick={() => handleKPITitleClick('Revenue')}
                className="text-xs md:text-sm font-bold text-gray-500 mb-1 md:mb-1 text-center tracking-wide hover:text-blue-600 transition-colors cursor-pointer px-2 md:px-3 py-0.5 md:py-1 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                REVENUE
              </button>
              {salesLoading ? (
                <div className="flex items-center justify-center p-2 md:p-4 text-gray-500 text-sm">Loading...</div>
              ) : (
                (() => {
                  const latestSalesIdx = monthlySalesData.reduce((idx, d, i) => d.actual > 0 ? i : idx, -1);
                  const activeIdx = latestSalesIdx >= 0 ? latestSalesIdx : (monthlySalesData.length > 0 ? monthlySalesData.length - 1 : 0);
                  const cumulActual = monthlySalesData.slice(0, activeIdx + 1).reduce((s, d) => s + Number(d.actual || 0), 0);
                  const cumulTarget = monthlySalesData.slice(0, activeIdx + 1).reduce((s, d) => s + Number(d.target || 0), 0);
                  const startEntry = monthlySalesData[0];
                  const endEntry = monthlySalesData[activeIdx];
                  const pct = cumulTarget > 0 ? Math.min((cumulActual / cumulTarget) * 100, 100) : 0;
                  const achievedAngle = (pct / 100) * 360;
                  const achievedRadians = (achievedAngle * Math.PI) / 180;
                  const radius = 70; const cx = 100; const cy = 100;
                  const x1 = cx + radius * Math.cos(-Math.PI / 2);
                  const y1 = cy + radius * Math.sin(-Math.PI / 2);
                  const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                  const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                  const largeArc = achievedAngle > 180 ? 1 : 0;
                  const startLabel = startEntry ? `${MONTH_LABELS[(startEntry.month || 1) - 1]} ${startEntry.year}` : '';
                  const endLabel = endEntry ? `${MONTH_LABELS[(endEntry.month || 1) - 1]} ${endEntry.year}` : '';
                  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
                  return (
                    <div className="flex flex-col items-center flex-1 min-w-0 justify-center h-full cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                      onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                    >
                      <h5 className="text-[9px] md:text-[10px] font-semibold text-gray-800 mb-1 whitespace-nowrap">
                        {dateLabel}
                      </h5>
                      <div className="flex flex-row items-center justify-center gap-2 md:gap-4 flex-1 h-full min-h-0 w-full">
                        <div className="flex items-center justify-center min-h-0">
                          <svg viewBox="0 0 200 200" className="w-[90px] md:w-[108px] h-[90px] md:h-[108px] flex-shrink-0" style={{maxHeight: '90px'}}>
                            <defs>
                              <filter id="revenueTextShadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.8" floodColor="#000000" />
                              </filter>
                            </defs>
                            {pct > 0 && (
                              <>
                                {pct >= 99.9 ? (
                                  <circle cx={cx} cy={cy} r={radius} fill="#0d47a1" stroke="white" strokeWidth="2" />
                                ) : (
                                  <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill="#0d47a1" stroke="white" strokeWidth="2" />
                                )}
                              </>
                            )}
                            {pct < 99.9 && (
                              <path d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`} fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                            )}
                            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="white" filter="url(#revenueTextShadow)">
                              {cumulActual.toFixed(0)}
                            </text>
                            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="white" filter="url(#revenueTextShadow)">
                              of {cumulTarget.toFixed(0)} target
                            </text>
                          </svg>
                        </div>
                        <div className="flex flex-col gap-1 md:gap-1.5 justify-center">
                          <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-gray-600">
                            <span className="w-2 md:w-2.5 h-2 md:h-2.5 bg-[#0d47a1] rounded flex-shrink-0"></span>
                            <span className="whitespace-nowrap font-medium">Actual: {cumulActual.toFixed(0)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-gray-600">
                            <span className="w-2 md:w-2.5 h-2 md:h-2.5 bg-[#f3f4f6] border border-[#d1d5db] rounded flex-shrink-0"></span>
                            <span className="whitespace-nowrap font-medium">Target: {cumulTarget.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
            
            {/* Profitability Section */}
            <div className="flex-1 px-2 pb-2 pt-1 md:px-4 md:pb-4 md:pt-1 flex flex-col border-t md:border-t-0 min-w-0 justify-center h-full">
              <button 
                onClick={() => handleKPITitleClick('Profitability')}
                className="text-xs md:text-sm font-bold text-gray-500 mb-1 md:mb-1 text-center tracking-wide hover:text-blue-600 transition-colors cursor-pointer px-2 md:px-3 py-0.5 md:py-1 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                PROFITABILITY (YTD)
              </button>
              {profitabilityLoading ? (
                <div className="flex items-center justify-center p-2 md:p-4 text-gray-500 text-sm">Loading...</div>
              ) : (
                <div className="flex items-center justify-center gap-1 md:gap-2 flex-1 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                >
                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-7 h-7 md:w-8 md:h-8 flex items-center justify-center cursor-pointer text-base md:text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlyProfitData.length) return;
                      setSelectedProfitIndex(selectedProfitIndex === 0 ? monthlyProfitData.length - 1 : selectedProfitIndex - 1);
                    }}
                    disabled={!monthlyProfitData.length}
                  >
                    ‹
                  </button>
                  <div className="flex flex-col items-center flex-initial min-w-0 justify-center h-full mx-2 md:mx-4">
                    <h5 className="text-[9px] md:text-[10px] font-semibold text-gray-800 mb-1 md:mb-1 whitespace-nowrap">
                      {MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}
                    </h5>
                    <div className="flex flex-row items-center justify-center gap-2 md:gap-4 flex-1 h-full min-h-0 w-full">
                      <div className="flex items-center justify-center min-h-0">
                        <svg viewBox="0 0 200 200" className="w-[90px] md:w-[108px] h-[90px] md:h-[108px] flex-shrink-0" style={{maxHeight: '90px'}}>
                        <defs>
                          <filter id="profitabilityTextShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.8" floodColor="#000000" />
                          </filter>
                        </defs>
                        {(() => {
                          const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                          const radius = 70;
                          const cx = 100;
                          const cy = 100;
                          const profit = profitData.profit;
                          const target = profitData.target;
                          const percentageAchieved = target > 0 ? Math.min((profit / target) * 100, 100) : 0;
                          
                          const achievedAngle = (percentageAchieved / 100) * 360;
                          const achievedRadians = (achievedAngle * Math.PI) / 180;
                          
                          const x1 = cx + radius * Math.cos(-Math.PI / 2);
                          const y1 = cy + radius * Math.sin(-Math.PI / 2);
                          const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                          const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                          
                          const largeArc = achievedAngle > 180 ? 1 : 0;
                          
                          return (
                            <>
                              {percentageAchieved > 0 && (
                                <>
                                  {percentageAchieved >= 99.9 ? (
                                    // Draw full circle when at or near 100%
                                    <circle cx={cx} cy={cy} r={radius} fill="#15803d" stroke="white" strokeWidth="2" />
                                  ) : (
                                    // Draw partial arc
                                    <path
                                      d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                      fill="#15803d"
                                      stroke="white"
                                      strokeWidth="2"
                                    />
                                  )}
                                </>
                              )}
                              
                              {percentageAchieved < 99.9 && (
                                <path
                                  d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`}
                                  fill="#f3f4f6"
                                  stroke="#d1d5db"
                                  strokeWidth="2"
                                />
                              )}
                              
                              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="white" filter="url(#profitabilityTextShadow)">
                                {profit.toFixed(1)}%
                              </text>
                              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="white" filter="url(#profitabilityTextShadow)">
                                of {target.toFixed(1)}% target
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                      </div>
                      
                      <div className="flex flex-col gap-1 md:gap-1.5 justify-center">
                        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-gray-600">
                          <span className="w-2 md:w-2.5 h-2 md:h-2.5 bg-[#15803d] rounded flex-shrink-0"></span>
                          <span className="whitespace-nowrap font-medium">Actual: {(monthlyProfitData[selectedProfitIndex]?.profit || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-gray-600">
                          <span className="w-2 md:w-2.5 h-2 md:h-2.5 bg-[#f3f4f6] border border-[#d1d5db] rounded flex-shrink-0"></span>
                          <span className="whitespace-nowrap font-medium">Target: {(monthlyProfitData[selectedProfitIndex]?.target || 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="bg-gray-100 border border-gray-300 rounded-full w-7 h-7 md:w-8 md:h-8 flex items-center justify-center cursor-pointer text-base md:text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!monthlyProfitData.length) return;
                      setSelectedProfitIndex(selectedProfitIndex === monthlyProfitData.length - 1 ? 0 : selectedProfitIndex + 1);
                    }}
                    disabled={!monthlyProfitData.length}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
        {/* Row 2: Cost (col-span-3) + On Time Delivery (col-span-3) */}
        {/* On Time Delivery */}
        <div className="w-full h-full min-h-0 lg:col-span-6 lg:row-span-1">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              onClick={() => handleKPITitleClick('On Time Delivery')}
              className="w-full mb-2 px-3 py-1 text-sm font-semibold text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              🚚 On Time Delivery
            </button>
            {onTimeDeliveryLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
            ) : onTimeDeliveryChart ? (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('onTimeDelivery', onTimeDeliveryChart)}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('onTimeDelivery', onTimeDeliveryChart)}
              >
                <OnTimeDeliveryBarChart title={onTimeDeliveryChart.title} subtitle={onTimeDeliveryChart.subtitle} labels={onTimeDeliveryChart.labels} actuals={onTimeDeliveryChart.actuals} targets={onTimeDeliveryChart.targets} showHeader={false} />
              </div>
            ) : (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('onTimeDelivery', { title: 'On Time Delivery', subtitle: 'Target vs Achieved', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('onTimeDelivery', { title: 'On Time Delivery', subtitle: 'Target vs Achieved', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
              >
                <OnTimeDeliveryBarChart title="On Time Delivery" subtitle="Target vs Achieved" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} actuals={Array(12).fill(0)} targets={Array(12).fill(0)} showHeader={false} />
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Zero Accidents, Green Factory, Morale (each col-span-2) */}
        {/* Zero Accidents */}
        <div className="w-full h-full min-h-0 lg:col-span-3">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              onClick={() => handleKPITitleClick('Zero Accidents')}
              className="w-full mb-2 px-3 py-1 text-sm font-semibold text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              🦺 Zero Accidents
            </button>
            {zeroAccidentsLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
            ) : zeroAccidentsChart ? (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('zeroAccidents', zeroAccidentsChart)}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('zeroAccidents', zeroAccidentsChart)}
              >
                <ZeroAccidentsBarChart title={zeroAccidentsChart.title} subtitle={zeroAccidentsChart.subtitle} labels={zeroAccidentsChart.labels} actuals={zeroAccidentsChart.actuals} targets={zeroAccidentsChart.targets} showHeader={false} />
              </div>
            ) : (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('zeroAccidents', { title: 'Safety', subtitle: 'Zero Accidents', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('zeroAccidents', { title: 'Safety', subtitle: 'Zero Accidents', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), actuals: Array(12).fill(0), targets: Array(12).fill(0) })}
              >
                <ZeroAccidentsBarChart title="Safety" subtitle="Zero Accidents" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} actuals={Array(12).fill(0)} targets={Array(12).fill(0)} showHeader={false} />
              </div>
            )}
          </div>
        </div>

        {/* Green Factory */}
        <div className="w-full h-full min-h-0 lg:col-span-3">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 overflow-hidden flex flex-col">
            <button 
              onClick={() => handleKPITitleClick('Green Factory')}
              className="w-full mb-2 px-3 py-1 text-sm font-semibold text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              🌿 Green Factory
            </button>
            {greenFactoryLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
            ) : greenFactoryChart ? (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('greenFactory', greenFactoryChart)}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('greenFactory', greenFactoryChart)}
              >
                <GreenFactoryBarChart title={greenFactoryChart.title} subtitle={greenFactoryChart.subtitle} labels={greenFactoryChart.labels} values={greenFactoryChart.values} showHeader={false} />
              </div>
            ) : (
              <div 
                className="flex-1 min-h-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openExpandedChart('greenFactory', { title: 'Environment', subtitle: 'Green Factory', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), values: Array(12).fill(0) })}
                onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('greenFactory', { title: 'Environment', subtitle: 'Green Factory', labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]), values: Array(12).fill(0) })}
              >
                <GreenFactoryBarChart title="Environment" subtitle="Green Factory" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} showHeader={false} />
              </div>
            )}
          </div>
        </div>

        {/* Morale */}
        <div className="w-full h-full min-h-0 lg:col-span-6">
          <div className="bg-white rounded-lg shadow border-2 border-blue-500 p-2 h-full min-h-0 flex flex-col overflow-hidden">
            <button
              onClick={() => handleKPITitleClick('Morale')}
              className="w-full mb-1 px-3 py-1 text-sm font-semibold text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              😊 Morale
            </button>
            <div className="flex flex-col md:flex-row h-full flex-1">
              <div className="flex-1 px-4 pb-4 pt-1 md:border-r border-gray-200 min-w-0">
                {themeChartLoading ? (
                  <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
                ) : (
                  <div 
                    className="h-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => openExpandedChart('themeEmployees', { themeChart, employeesChart })}
                    onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('themeEmployees', { themeChart, employeesChart })}
                  >
                    {themeChart ? (
                      <Box4ThemeBarChart title={themeChart.title} subtitle={themeChart.subtitle} labels={themeChart.labels} values={themeChart.values} showHeader={false} showSubtitle={true} />
                    ) : (
                      <Box4ThemeBarChart title="Theme Of The Year" subtitle="Unlock The Power of You" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} showHeader={false} showSubtitle={true} />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 px-4 pb-4 pt-1 min-w-0">
                {employeesChartLoading ? (
                  <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
                ) : (
                  <div 
                    className="h-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => openExpandedChart('themeEmployees', { themeChart, employeesChart })}
                    onKeyDown={(e)=> e.key === 'Enter' && openExpandedChart('themeEmployees', { themeChart, employeesChart })}
                  >
                    {employeesChart ? (
                      <Box4EmployeesLineChart title={employeesChart.title} subtitle={employeesChart.subtitle} labels={employeesChart.labels} values={employeesChart.values} showHeader={false} showSubtitle={true} />
                    ) : (
                      <Box4EmployeesLineChart title="No. of Employees Who Left" subtitle="Monthly Attrition" labels={FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])} values={Array(12).fill(0)} showHeader={false} showSubtitle={true} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
      {/* Performance Dashboard Section End */}

      {/* Pillars Section */}
      <div className="mt-8">
        <PillarRadarChart
          pillars={[...pillerStats.pillers].sort((a, b) => (a.piller_name || '').localeCompare(b.piller_name || ''))}
          onPillarClick={(pillar) => {
            if (pillar?.id) {
              navigate(`/management/pillar/${pillar.id}`);
            }
          }}
        />
      </div>
      {/* Pillars Section End*/}


      {/* Overview Cards */}
      <h2 className="text-2xl text-center justify-center font-bold text-gray-800 mb-6">Overview</h2>
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
      {/* Overview Cards End*/}

     

      {expandedChart && expandedChartData && (
        <div className="expanded-chart-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeExpandedChart}>
          <div className="expanded-chart-modal-content bg-white rounded-xl shadow-2xl w-[95%] max-w-7xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateChart('prev')}
                  className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 border border-blue-200"
                  title="Previous Graph (or use Left Arrow)"
                >
                  ◀ Prev
                </button>
                <span className="text-sm font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md">
                  {CHART_KEYS.indexOf(expandedChart) + 1} / {CHART_KEYS.length}
                </span>
                <button
                  type="button"
                  onClick={() => navigateChart('next')}
                  className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 border border-blue-200"
                  title="Next Graph (or use Right Arrow)"
                >
                  Next ▶
                </button>
              </div>
              <h2 className="text-xl font-bold text-gray-800 text-center flex-1 order-3 sm:order-none min-w-full sm:min-w-0">
                {expandedChart === 'plantEfficiency'
                  ? 'Plant Efficiency (Apr - Mar)'
                  : expandedChart === 'industry40'
                  ? expandedChartData.title || 'Industry 4.0'
                  : expandedChart === 'zeroQuality'
                  ? expandedChartData.title || 'Zero Quality Complaints'
                  : expandedChart === 'zeroAccidents'
                  ? expandedChartData.title || 'Zero Accidents'
                  : expandedChart === 'onTimeDelivery'
                  ? expandedChartData.title || 'On Time Delivery'
                  : expandedChart === 'themeChart'
                  ? expandedChartData.title || 'Theme Of The Year'
                  : expandedChart === 'employeesChart'
                  ? expandedChartData.title || 'Employees Left'
                  : expandedChart === 'greenFactory'
                  ? expandedChartData.title || 'Green Factory'
                  : expandedChart === 'themeEmployees'
                  ? 'Morale (Theme Of The Year & Employees Left)'
                  : expandedChart === 'salesProfit'
                  ? 'Revenue & Profitability'
                  : 'Chart'}
              </h2>
              <button className="text-2xl p-1 mr-2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none" onClick={closeExpandedChart}>✕</button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto flex flex-col justify-center">
              {expandedChart === 'plantEfficiency' && (
                <div className="flex items-center justify-center gap-12 w-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentList = expandedChartData?.monthlyEfficiency || monthlyEfficiency;
                      const currentIndex = expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex;
                      if (!currentList.length) return;
                      const nextIndex = currentIndex === 0 ? currentList.length - 1 : currentIndex - 1;
                      setSelectedFiscalIndex(nextIndex);
                      setExpandedChartData({ ...expandedChartData, monthlyEfficiency: currentList, selectedFiscalIndex: nextIndex });
                    }}
                    disabled={(expandedChartData?.monthlyEfficiency || monthlyEfficiency).length <= 1}
                    className="relative z-30 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md hover:scale-105 active:scale-95"
                    title="Previous Month"
                  >
                    ‹
                  </button>
                  <SpeedometerGauge
                    efficiency={(expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.efficiency || 0}
                    month={MONTH_LABELS[((expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.month || 1) - 1]}
                    year={(expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.year || ''}
                    isExpanded={true}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentList = expandedChartData?.monthlyEfficiency || monthlyEfficiency;
                      const currentIndex = expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex;
                      if (!currentList.length) return;
                      const nextIndex = currentIndex === currentList.length - 1 ? 0 : currentIndex + 1;
                      setSelectedFiscalIndex(nextIndex);
                      setExpandedChartData({ ...expandedChartData, monthlyEfficiency: currentList, selectedFiscalIndex: nextIndex });
                    }}
                    disabled={(expandedChartData?.monthlyEfficiency || monthlyEfficiency).length <= 1}
                    className="relative z-30 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md hover:scale-105 active:scale-95"
                    title="Next Month"
                  >
                    ›
                  </button>
                </div>
              )}

              {expandedChart === 'industry40' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'zeroQuality' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'zeroAccidents' && (
                <ZeroAccidentsBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'onTimeDelivery' && (
                <OnTimeDeliveryBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  targets={expandedChartData.targets}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'themeChart' && (
                <Box4ThemeBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'employeesChart' && (
                <Box4EmployeesLineChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'greenFactory' && (
                <GreenFactoryBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  values={expandedChartData.values}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'themeEmployees' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full p-4">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h4 className="font-semibold text-lg text-gray-700 mb-4 border-b pb-2">Theme Of The Year</h4>
                    <Box4ThemeBarChart
                      title={expandedChartData?.themeChart?.title || 'Theme Of The Year'}
                      subtitle={expandedChartData?.themeChart?.subtitle || 'Unlock The Power of You'}
                      labels={expandedChartData?.themeChart?.labels || FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])}
                      values={expandedChartData?.themeChart?.values || Array(12).fill(0)}
                      isExpanded={true}
                    />
                  </div>

                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h4 className="font-semibold text-lg text-gray-700 mb-4 border-b pb-2">Employees Left</h4>
                    <Box4EmployeesLineChart
                      title={expandedChartData?.employeesChart?.title || 'No. of Employees Who Left'}
                      subtitle={expandedChartData?.employeesChart?.subtitle || 'Monthly Attrition'}
                      labels={expandedChartData?.employeesChart?.labels || FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])}
                      values={expandedChartData?.employeesChart?.values || Array(12).fill(0)}
                      isExpanded={true}
                    />
                  </div>
                </div>
              )}

              {expandedChart === 'salesProfit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex-1 p-4 rounded-lg border border-gray-100">
                    <h4 className="font-semibold mb-3 text-center">Revenue</h4>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === 0 ? monthlySalesData.length - 1 : selectedSalesIndex - 1); }}
                        disabled={!monthlySalesData.length}
                      >
                        ‹
                      </button>
                      <div className="flex flex-col items-center">
                        <h5 className="text-sm font-semibold text-gray-800 mb-2">
                          {MONTH_LABELS[(monthlySalesData[selectedSalesIndex]?.month || 1) - 1]} {monthlySalesData[selectedSalesIndex]?.year || ''}
                        </h5>
                        <div className="flex items-center justify-center">
                          <svg viewBox="0 0 200 200" className="w-[160px] h-[160px]">
                            <defs>
                              <filter id="revenueModalTextShadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.8" floodColor="#000000" />
                              </filter>
                            </defs>
                            {(() => {
                              const salesData = monthlySalesData[selectedSalesIndex] || { actual: 0, target: 0 };
                              const radius = 70;
                              const cx = 100;
                              const cy = 100;
                              const actual = Number(salesData.actual || 0);
                              const target = Number(salesData.target || 0);
                              const percentageAchieved = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
                              const achievedAngle = (percentageAchieved / 100) * 360;
                              const achievedRadians = (achievedAngle * Math.PI) / 180;
                              const x1 = cx + radius * Math.cos(-Math.PI / 2);
                              const y1 = cy + radius * Math.sin(-Math.PI / 2);
                              const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                              const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                              const largeArc = achievedAngle > 180 ? 1 : 0;
                              return (
                                <>
                                  {percentageAchieved > 0 && (
                                    <>
                                      {percentageAchieved >= 99.9 ? (
                                        <circle cx={cx} cy={cy} r={radius} fill="#0d47a1" stroke="white" strokeWidth="2" />
                                      ) : (
                                        <path
                                          d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                          fill="#0d47a1"
                                          stroke="white"
                                          strokeWidth="2"
                                        />
                                      )}
                                    </>
                                  )}
                                  {percentageAchieved < 99.9 && (
                                    <path
                                      d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`}
                                      fill="#f3f4f6"
                                      stroke="#d1d5db"
                                      strokeWidth="2"
                                    />
                                  )}
                                  <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="white" filter="url(#revenueModalTextShadow)">
                                    {actual.toFixed(0)}
                                  </text>
                                  <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="white" filter="url(#revenueModalTextShadow)">
                                    of {target.toFixed(0)} target
                                  </text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-3 h-3 bg-[#0d47a1] rounded"></span>
                            <span>Actual: {Number(monthlySalesData[selectedSalesIndex]?.actual || 0).toFixed(0)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-3 h-3 bg-[#0d47a1] rounded"></span>
                            <span>Target: {Number(monthlySalesData[selectedSalesIndex]?.target || 0).toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                        onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === monthlySalesData.length - 1 ? 0 : selectedSalesIndex + 1); }}
                        disabled={!monthlySalesData.length}
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-4 rounded-lg border border-gray-100">
                    <h4 className="font-semibold mb-3 text-center">Profitability</h4>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={(e) => { e.stopPropagation(); if (!monthlyProfitData.length) return; setSelectedProfitIndex(selectedProfitIndex === 0 ? monthlyProfitData.length - 1 : selectedProfitIndex - 1); }}
                        disabled={!monthlyProfitData.length}
                      >
                        ‹
                      </button>
                      <div className="flex flex-col items-center">
                        <h5 className="text-sm font-semibold text-gray-800 mb-2">
                          {MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}
                        </h5>
                        <div className="flex items-center justify-center">
                          <svg viewBox="0 0 200 200" className="w-[160px] h-[160px]">
                            <defs>
                              <filter id="profitModalTextShadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.8" floodColor="#000000" />
                              </filter>
                            </defs>
                            {(() => {
                              const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                              const radius = 70;
                              const cx = 100;
                              const cy = 100;
                              const profit = profitData.profit;
                              const target = profitData.target;
                              const percentageAchieved = target > 0 ? Math.min((profit / target) * 100, 100) : 0;
                              const achievedAngle = (percentageAchieved / 100) * 360;
                              const achievedRadians = (achievedAngle * Math.PI) / 180;
                              const x1 = cx + radius * Math.cos(-Math.PI / 2);
                              const y1 = cy + radius * Math.sin(-Math.PI / 2);
                              const x2 = cx + radius * Math.cos(-Math.PI / 2 + achievedRadians);
                              const y2 = cy + radius * Math.sin(-Math.PI / 2 + achievedRadians);
                              const largeArc = achievedAngle > 180 ? 1 : 0;
                              return (
                                <>
                                  {percentageAchieved > 0 && (
                                    <>
                                      {percentageAchieved >= 99.9 ? (
                                        <circle cx={cx} cy={cy} r={radius} fill="#15803d" stroke="white" strokeWidth="2" />
                                      ) : (
                                        <path
                                          d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                          fill="#15803d"
                                          stroke="white"
                                          strokeWidth="2"
                                        />
                                      )}
                                    </>
                                  )}
                                  {percentageAchieved < 99.9 && (
                                    <path
                                      d={`M ${cx} ${cy} L ${x2} ${y2} A ${radius} ${radius} 0 ${achievedAngle > 180 ? 0 : 1} 1 ${x1} ${y1} Z`}
                                      fill="#f3f4f6"
                                      stroke="#d1d5db"
                                      strokeWidth="2"
                                    />
                                  )}
                                  <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="white" filter="url(#profitModalTextShadow)">
                                    {profit.toFixed(1)}%
                                  </text>
                                  <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="white" filter="url(#profitModalTextShadow)">
                                    of {target.toFixed(1)}% target
                                  </text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-3 h-3 bg-[#15803d] rounded"></span>
                            <span>Actual: {(monthlyProfitData[selectedProfitIndex]?.profit || 0).toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-3 h-3 bg-[#15803d] rounded"></span>
                            <span>Target: {(monthlyProfitData[selectedProfitIndex]?.target || 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                        onClick={(e) => { e.stopPropagation(); if (!monthlyProfitData.length) return; setSelectedProfitIndex(selectedProfitIndex === monthlyProfitData.length - 1 ? 0 : selectedProfitIndex + 1); }}
                        disabled={!monthlyProfitData.length}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagementDashboard;
