import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getKPIs } from '../../api/kpiApi';
import { getPillers } from '../../api/pillerApi';
import { getUsers } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import api, { API_URL } from '../../api/axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate fiscal month sequence for a given fiscal year (April to March)
const getFiscalMonthSequence = (fiscalYear) => {
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((3 + i) % 12) + 1; // April (4) through March (3)
    const year = month >= 4 ? fiscalYear : fiscalYear + 1;
    return { month, year };
  });
};

// Shared styled tooltip for all Recharts visualizations
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label != null && <div className="mb-1 font-bold text-slate-700">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color || p.stroke || p.fill }}></span>
          <span className="font-semibold text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const formatINR = (num) => Number(num || 0).toLocaleString('en-IN');

// Industry 4.0 KPI — Recharts bar (actual)
const Industry40LineChart = ({
  title,
  labels,
  actuals,
  showHeader = true,
  isExpanded = false,
  allowDecimals = true,
  unit = '%',
}) => {
  const data = labels.map((label, i) => ({ name: label, Actual: actuals[i] ?? 0 }));
  const max = Math.max(...actuals, 1);
  const yMax = Math.ceil(max * 1.15);
  const tf = isExpanded ? 13 : 12;
  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <h2 className="mb-1 text-center text-base font-bold text-slate-800">{title}</h2>}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="i40Bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: tf, fill: '#0f172a', fontWeight: 800 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
            <YAxis domain={[0, yMax]} unit={unit} allowDecimals={allowDecimals} tick={{ fontSize: tf, fill: '#0f172a', fontWeight: 800 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="Actual" fill="url(#i40Bar)" radius={[6, 6, 0, 0]} maxBarSize={36} name="Actual">
              <LabelList dataKey="Actual" position="top" formatter={(v) => unit ? `${Math.round(v)}${unit}` : Math.round(v)} style={{ fontSize: tf, fill: '#0369a1', fontWeight: 800 }} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};


// Speedometer Gauge Component for Plant Efficiency
const SpeedometerGauge = ({ efficiency, month, year }) => {
  const value = Math.max(0, Math.min(100, Number(efficiency) || 0));
  let color = '#ef4444';
  if (value > 75) {
    color = '#22c55e';
  } else if (value > 50) {
    color = '#eab308';
  }
  const angle = -180 + (value / 100) * 180;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center" style={{ overflow: 'hidden' }}>
      <div className="text-[9px] font-bold text-slate-700 sm:text-[10px] leading-none">{month} {year}</div>
      <div className="relative w-full flex-1 min-h-0 flex items-center justify-center">
        <svg
          viewBox="0 0 300 220"
          className="w-full h-auto"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          title={`${month} ${year}: ${value.toFixed(1)}%`}
        >
          <path d="M 12 180 A 138 138 0 0 1 288 180" fill="none" stroke="#e5e7eb" strokeWidth="24" strokeLinecap="round" />
          <path d="M 12 180 A 138 138 0 0 1 150 42" fill="none" stroke="#ef4444" strokeWidth="24" strokeLinecap="round" />
          <path d="M 150 42 A 138 138 0 0 1 247 82" fill="none" stroke="#eab308" strokeWidth="24" strokeLinecap="round" />
          <path d="M 247 82 A 138 138 0 0 1 288 180" fill="none" stroke="#22c55e" strokeWidth="24" strokeLinecap="round" />
          <line x1="18" y1="180" x2="32" y2="180" stroke="#374151" strokeWidth="3" />
          <line x1="150" y1="42" x2="150" y2="58" stroke="#374151" strokeWidth="3" />
          <line x1="247" y1="82" x2="235" y2="90" stroke="#374151" strokeWidth="3" />
          <line x1="282" y1="180" x2="268" y2="180" stroke="#374151" strokeWidth="3" />
          <g transform={`rotate(${angle}, 150, 180)`} style={{ transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <line x1="150" y1="180" x2="272" y2="180" stroke={color} strokeWidth="5" strokeLinecap="round" />
            <polygon points="272,180 255,171 255,189" fill={color} />
          </g>
          <circle cx="150" cy="180" r="14" fill={color} />
          <circle cx="150" cy="180" r="5" fill="#fff" />
          <text x="8" y="204" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="start">0</text>
          <text x="150" y="28" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="middle">50</text>
          <text x="247" y="76" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="middle">75</text>
          <text x="292" y="204" fontSize="14" fontWeight="700" fill="#4b5563" textAnchor="end">100</text>
        </svg>
      </div>
      <div className="text-center mt-0.5">
        <div className="font-extrabold text-gray-800 text-base sm:text-lg">{value.toFixed(1)}%</div>
      </div>
    </div>
  );
};

// Bar Chart Component for Green Factory
const GreenFactoryBarChart = ({ title, subtitle, labels, values, showHeader = true, showAxisLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Value', isExpanded = false }) => {
  const data = labels.map((label, i) => ({ name: label, Value: values[i] ?? 0 }));
  const max = Math.max(...values, 100);
  const yMax = Math.ceil(max * 1.15);
  const tf = isExpanded ? 13 : 12;
  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <h2 className="mb-1 text-center text-base font-bold text-slate-800">{title}</h2>}
      {showHeader && subtitle && <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{subtitle}</p>}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gfBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 800 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
            <YAxis domain={[0, yMax]} unit="%" tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 800 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="Value" fill="url(#gfBar)" radius={[6, 6, 0, 0]} maxBarSize={48} name="Value">
              <LabelList dataKey="Value" position="top" formatter={(v) => `${Math.round(v)}%`} style={{ fontSize: tf, fill: '#065f46', fontWeight: 800 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Bar Chart component for Zero Accidents (shows actual vs target per month)
const ZeroAccidentsBarChart = ({ title, subtitle, labels, actuals, showHeader = true, isExpanded = false, className = '' }) => {
  const raw = labels.map((label, i) => ({
    name: (() => {
      const n = Number(String(label).trim());
      return Number.isInteger(n) && n >= 1 && n <= 12 ? MONTH_LABELS[n - 1] : String(label);
    })(),
    Actual: Number(actuals[i] ?? 0),
  }));
  const hasData = raw.some((d) => d.Actual !== 0);
  const data = hasData ? raw.filter((d) => d.Actual !== 0) : raw;
  const max = Math.max(...data.map((d) => d.Actual), 1);
  const yMax = max <= 10 ? max + 1 : Math.ceil(max * 1.15);
  const tf = isExpanded ? 14 : 13;
  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {showHeader && <h2 className="mb-1 text-center text-base font-bold text-slate-800">{title}</h2>}
      {showHeader && subtitle && <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{subtitle}</p>}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} interval="preserveStartEnd" />
            <YAxis domain={[0, yMax]} tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 700 }} tickLine={false} axisLine={false} width={38} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} name="Actual">
              <LabelList dataKey="Actual" position="top" formatter={(v) => Math.round(v)} style={{ fontSize: tf, fill: '#1e3a8a', fontWeight: 800 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// On Time Delivery mixed chart (Target line + Achieved bars)
const OnTimeDeliveryBarChart = ({ title, subtitle, labels, actuals, targets, showHeader = true, isExpanded = false }) => {
  const data = labels.map((label, i) => ({ name: label, Achieved: Number(actuals[i] ?? 0), Target: Number(targets[i] ?? 0) }));
  const max = Math.max(...actuals, ...targets, 1);
  const yMax = Math.ceil(max * 1.15);
  const tf = isExpanded ? 14 : 13;
  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <h2 className="mb-1 text-center text-base font-bold text-slate-800">{title}</h2>}
      {showHeader && subtitle && <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{subtitle}</p>}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="otdBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
            <YAxis domain={[0, yMax]} tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 700 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="Achieved" fill="url(#otdBar)" radius={[4, 4, 0, 0]} maxBarSize={36} name="Achieved">
              <LabelList dataKey="Achieved" position="top" formatter={(v) => `${Math.round(v)}%`} style={{ fontSize: tf, fill: '#14532d', fontWeight: 800 }} />
            </Bar>
            <Line dataKey="Target" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Target" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};



// Employees left line chart
// Employees left line chart
const Box4EmployeesLineChart = ({ title, subtitle, labels, values, showAxisLabels = true, showPointLabels = true, xAxisTitle = 'Month', yAxisTitle = 'Count', showHeader = true, showSubtitle, isExpanded = false }) => {
  const data = labels.map((label, i) => ({ name: label, Count: values[i] ?? 0 }));
  const max = Math.max(...values, 1);
  const yMax = Math.ceil(max * 1.15);
  const tf = isExpanded ? 13 : 12;
  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <h2 className="mb-1 text-center text-base font-bold text-slate-800">{title}</h2>}
      {(showHeader || showSubtitle) && subtitle && <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{subtitle}</p>}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="employeeArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 800 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
            <YAxis domain={[0, yMax]} allowDecimals={false} tick={{ fontSize: tf, fill: '#1e293b', fontWeight: 800 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="Count" stroke="#ef4444" strokeWidth={3} fill="url(#employeeArea)" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Count">
              <LabelList dataKey="Count" position="top" formatter={(v) => Math.round(v)} style={{ fontSize: tf, fill: '#b91c1c', fontWeight: 800 }} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Radar chart for pillar overview
const PillarRadarChart = ({ pillars, onPillarClick, compact = false }) => {
  const data = (pillars || []).map((pillar, index) => {
    const rawValue =
      pillar?.kpi_count ??
      pillar?.kpis_count ??
      pillar?.kpiCount ??
      pillar?.total_kpis ??
      pillar?.kpis?.length ??
      pillar?.count ??
      1;
    return {
      subject: pillar?.short_name || pillar?.piller_name || pillar?.pillar_name || `Pillar ${index + 1}`,
      value: Number(rawValue) || 0,
      pillar,
    };
  });

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="78%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
        <PolarRadiusAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} strokeWidth={2} />
        <Tooltip content={<ChartTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );

  if (compact) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-[260px] w-full">{chart}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-gray-500 shadow-lg">No pillars available</div>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      <div className="mb-3">
        <h3 className="text-xl font-bold text-slate-800">Explore Pillars</h3>
        <p className="text-sm text-slate-500">Radar view of pillar KPIs for the selected financial year</p>
      </div>
      <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
        <div className="h-[360px] w-full lg:w-[420px]">{chart}</div>
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.map((d) => (
              <button
                key={d.pillar?.id || d.subject}
                type="button"
                onClick={() => onPillarClick?.(d.pillar)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{d.pillar?.piller_name || d.pillar?.pillar_name || d.subject}</div>
                    {d.pillar?.short_name && <div className="text-xs text-slate-500">{d.pillar.short_name}</div>}
                  </div>
                  <div className="text-lg font-bold text-blue-700">{d.value}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DepartmentPerformanceRadarChart = ({ departments, onDepartmentClick }) => {
  const data = (departments || []).map((department, index) => ({
    subject: department?.name || `Department ${index + 1}`,
    value: Math.max(0, Math.min(100, Number(department?.value) || 0)),
    department,
  }));

  const CustomDepartmentTick = (props) => {
    const { x, y, payload } = props;
    const dept = data.find(d => d.subject === payload?.value)?.department;
    return (
      <text
        x={x}
        y={y}
        onClick={() => onDepartmentClick?.(dept)}
        style={{ cursor: 'pointer', fontSize: 12, fill: '#334155', fontWeight: 600 }}
      >
        {payload?.value}
      </text>
    );
  };

  if (!data.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <div className="py-16 text-center text-gray-500">No department performance data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      <div className="h-[460px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={<CustomDepartmentTick />} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
            <Radar dataKey="value" stroke="#15803d" fill="#15803d" fillOpacity={0.25} strokeWidth={2} onClick={(event) => onDepartmentClick?.(event?.activePayload?.[0]?.payload?.department)} />
            <Tooltip content={<ChartTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
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
  const [allUsers, setAllUsers] = useState([]);
  const [staffPerformanceData, setStaffPerformanceData] = useState({});
  const [staffPerformanceLoading, setStaffPerformanceLoading] = useState(false);
  const [departmentStats, setDepartmentStats] = useState({
    total: 0
  });
  const [departmentPerformance, setDepartmentPerformance] = useState([]);
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

  const [employeesChart, setEmployeesChart] = useState(null);
  const [employeesChartLoading, setEmployeesChartLoading] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null);
  const [expandedChartData, setExpandedChartData] = useState(null);
  const [kpiIdMap, setKpiIdMap] = useState({});
  const navigate = useNavigate();

  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [cachedKpiValues, setCachedKpiValues] = useState([]);
  const departmentPerformanceForChart = useMemo(() => {
    if (!departmentPerformance.length) return [];

    const maxObservedValue = Math.max(
      ...departmentPerformance.map((department) => Number(department?.value) || 0),
      0
    );

    return departmentPerformance.map((department) => {
      const currentValue = Number(department?.value) || 0;
      const currentPercent = maxObservedValue > 0 ? Math.round((currentValue / maxObservedValue) * 100) : 0;

      return {
        ...department,
        value: currentValue > 0 ? currentPercent : 0,
      };
    });
  }, [departmentPerformance]);

  const getPhotoUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/api/uploads/') || path.startsWith('/uploads/')) {
      try {
        const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
        return `${appOrigin}${path}`;
      } catch {
        return path;
      }
    }
    return path;
  };

  const staffList = useMemo(() => {
    if (!allUsers.length) return [];
    const activeUsers = allUsers.filter(u => (u.status || '').toLowerCase() === 'active');
    return activeUsers
      .map(user => {
        if (!Object.prototype.hasOwnProperty.call(staffPerformanceData, user.id)) return null;

        const performance = staffPerformanceData[user.id] || 0;
        const firstName = (user.firstname || '').trim();
        const middleName = (user.middlename || '').trim();
        const lastName = (user.lastname || '').trim();
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || user.email || `User ${user.id}`;
        return {
          id: user.id,
          name: fullName,
          designation: user.designation_name || '',
          photo: user.staff_photo || '',
          performance,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.performance - a.performance || a.name.localeCompare(b.name));
  }, [allUsers, staffPerformanceData]);

  const StaffPerformanceList = ({ staffList, loading }) => {
    if (loading) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-gray-500 shadow-lg">
          Loading staff performance...
        </div>
      );
    }

    if (!staffList.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-gray-500 shadow-lg">
          No staff data available
        </div>
      );
    }

    const best = staffList.filter(s => s.performance >= 66);
    const medium = staffList.filter(s => s.performance >= 33 && s.performance < 66);
    const low = staffList.filter(s => s.performance < 33);

    const StaffCard = ({ staff }) => {
      let perfColor = 'bg-red-100 text-red-700 border-red-300';
      if (staff.performance >= 66) perfColor = 'bg-green-100 text-green-700 border-green-300';
      else if (staff.performance >= 33) perfColor = 'bg-orange-100 text-orange-700 border-orange-300';

      const photoUrl = getPhotoUrl(staff.photo);
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={staff.name} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs border-2 border-white shadow-sm">
                {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate text-sm">{staff.name}</div>
            <div className="text-xs text-gray-500 truncate">{staff.designation || 'No designation'}</div>
          </div>
          <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${perfColor}`}>
            {staff.performance}%
          </div>
        </div>
      );
    };

    const Column = ({ title, color, items }) => (
      <div className="flex flex-col gap-2">
        <div className={`rounded-t-lg border border-b-0 px-3 py-2 text-center font-extrabold text-sm ${color}`}>
          {title} ({items.length})
        </div>
        <div className="flex-1 overflow-y-auto rounded-b-lg border border-t-0 bg-slate-50/50 p-2 space-y-2" style={{ maxHeight: '600px' }}>
          {items.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">No staff</div>
          ) : (
            items.map(staff => <StaffCard key={staff.id} staff={staff} />)
          )}
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column title="BEST" color="bg-green-100 text-green-800 border-green-300" items={best} />
        <Column title="MEDIUM" color="bg-orange-100 text-orange-800 border-orange-300" items={medium} />
        <Column title="LOW" color="bg-red-100 text-red-800 border-red-300" items={low} />
      </div>
    );
  };

  // Computed fiscal month sequence based on selected year
  const FISCAL_MONTH_SEQUENCE = useMemo(() => getFiscalMonthSequence(selectedFiscalYear), [selectedFiscalYear]);

  const previousMonthReferenceDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }, []);

  const getPreferredPreviousMonthIndex = (rows, fiscalYear) => {
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    const currentFiscalYear = getCurrentFiscalYear();

    if (fiscalYear === currentFiscalYear) {
      const prevMonth = previousMonthReferenceDate.getMonth() + 1;
      const prevYear = previousMonthReferenceDate.getFullYear();
      const exactMatch = rows.findIndex((row) => Number(row.month) === prevMonth && Number(row.year) === prevYear);
      if (exactMatch >= 0) return exactMatch;

      let bestIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const rowMonth = Number(rows[i]?.month);
        const rowYear = Number(rows[i]?.year);
        if (!Number.isFinite(rowMonth) || !Number.isFinite(rowYear)) continue;
        const rowDate = new Date(rowYear, rowMonth - 1, 1);
        if (rowDate <= previousMonthReferenceDate) {
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) return bestIdx;
    }

    return 0;
  };

  // (no responsive CSS injection here) keep original sizing logic

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
          loadEmployeesChart(fiscalValues)
        ]);

        // Log any failures
        chartResults.forEach((result, index) => {
          const chartNames = ['Industry40', 'ZeroQuality', 'Sales', 'Profitability', 'PlantEfficiency', 'GreenFactory', 'ZeroAccidents', 'OnTimeDelivery', 'Employees'];
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

  useEffect(() => {
    loadStaffPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedKpiValues, allUsers, selectedFiscalYear]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      let fiscalKpis = [];
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
        fiscalKpis = kpis;

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
        setAllUsers(users);
      }

      if (departmentsResponse?.data) {
        const departmentsData = departmentsResponse.data;
        const departments = Array.isArray(departmentsData) ? departmentsData : (Array.isArray(departmentsData?.data) ? departmentsData.data : []);
        setDepartmentStats({
          total: departments.length
        });

        try {
          const mappingResponse = await api.get('/kpi-departments');
          const allMappings = mappingResponse?.data?.data || [];
          const fiscalKpiIds = new Set((fiscalKpis || []).map((kpi) => Number(kpi.id)).filter(Number.isFinite));
          const countByDepartmentId = new Map();

          departments.forEach((department) => {
            countByDepartmentId.set(Number(department.id), 0);
          });

          allMappings.forEach((mapping) => {
            const departmentId = Number(mapping.department_id);
            const kpiId = Number(mapping.kpi_id);
            if (!countByDepartmentId.has(departmentId)) return;
            if (fiscalKpiIds.size > 0 && !fiscalKpiIds.has(kpiId)) return;
            countByDepartmentId.set(departmentId, (countByDepartmentId.get(departmentId) || 0) + 1);
          });

          const departmentRadarData = departments
            .map((department) => ({
              id: department.id,
              name: department.department_name || department.departmentName || `Department ${department.id}`,
              value: countByDepartmentId.get(Number(department.id)) || 0,
            }))
            .sort((a, b) => b.value - a.value);

          setDepartmentPerformance(departmentRadarData);
        } catch (mappingError) {
          console.error('Error loading department performance data:', mappingError);
          setDepartmentPerformance(
            departments.map((department) => ({
              id: department.id,
              name: department.department_name || department.departmentName || `Department ${department.id}`,
              value: 0,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaffPerformance = async () => {
    if (!cachedKpiValues.length || !allUsers.length) {
      setStaffPerformanceData({});
      return;
    }

    setStaffPerformanceLoading(true);
    try {
      const kpiValuesByEmp = {};
      const empidToUserId = {};

      allUsers.forEach(user => {
        const empid = user.empid;
        if (!empid) return;
        empidToUserId[empid] = user.id;
        kpiValuesByEmp[empid] = [];
      });

      cachedKpiValues.forEach(kv => {
        const empid = kv.data_operator;
        if (!empid || !kpiValuesByEmp[empid]) return;
        kpiValuesByEmp[empid].push(kv);
      });

      const allKpiValueIds = new Set();
      Object.values(kpiValuesByEmp).forEach(kvList => {
        kvList.forEach(kv => allKpiValueIds.add(kv.id));
      });

      if (allKpiValueIds.size === 0) {
        setStaffPerformanceData({});
        return;
      }

      const ids = Array.from(allKpiValueIds);
      const year1 = selectedFiscalYear;
      const year2 = selectedFiscalYear + 1;

      const [resp1, resp2] = await Promise.allSettled([
        api.post('/kpi-data-values/multiple', { kpiValueIds: ids, year: year1 }),
        api.post('/kpi-data-values/multiple', { kpiValueIds: ids, year: year2 }),
      ]);

      const allDataValues = [
        ...(resp1.status === 'fulfilled' ? (resp1.value?.data?.data || []) : []),
        ...(resp2.status === 'fulfilled' ? (resp2.value?.data?.data || []) : []),
      ];

      const dataByKpiValueId = {};
      allDataValues.forEach(dv => {
        if (!dataByKpiValueId[dv.kpi_value_id]) dataByKpiValueId[dv.kpi_value_id] = [];
        dataByKpiValueId[dv.kpi_value_id].push(dv);
      });

      const fiscalMonths = getFiscalMonthSequence(selectedFiscalYear);
      const fiscalMonthKeys = new Set(fiscalMonths.map(m => `${m.month}_${m.year}`));

      const performanceByUserId = {};

      Object.entries(kpiValuesByEmp).forEach(([empid, kvList]) => {
        const userId = empidToUserId[empid];
        if (!userId) return;

        let totalAchievement = 0;
        let kpiCount = 0;

        kvList.forEach(kv => {
          if (kv.target_required === false || String(kv.target_required).toLowerCase() === 'false') return;

          const kpiDataValues = dataByKpiValueId[kv.id] || [];
          const fiscalData = kpiDataValues.filter(dv => fiscalMonthKeys.has(`${dv.month}_${dv.year}`));

          if (fiscalData.length === 0) return;

          const byMonth = {};
          fiscalData.forEach(dv => {
            const key = `${dv.month}_${dv.year}`;
            if (!byMonth[key]) byMonth[key] = { actual: null, target: null };
            byMonth[key][dv.value_type === 'actual' ? 'actual' : 'target'] = parseFloat(dv.value) || 0;
          });

          const monthlyAchievements = [];

          Object.values(byMonth).forEach(m => {
            const actual = m.actual;
            const target = m.target;

            if (actual == null || target == null || target === 0) return;

            const achievement = Math.min((actual / target) * 100, 100);

            monthlyAchievements.push(achievement);
          });

          if (monthlyAchievements.length > 0) {
            const kpiAvg = monthlyAchievements.reduce((a, b) => a + b, 0) / monthlyAchievements.length;
            totalAchievement += kpiAvg;
            kpiCount++;
          }
        });

        if (kpiCount > 0) {
          performanceByUserId[userId] = Math.round(totalAchievement / kpiCount);
        }
      });

      setStaffPerformanceData(performanceByUserId);
    } catch (error) {
      console.error('Error loading staff performance:', error);
      setStaffPerformanceData({});
    } finally {
      setStaffPerformanceLoading(false);
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

      const targetIndex = getPreferredPreviousMonthIndex(FISCAL_MONTH_SEQUENCE, selectedFiscalYear);

      const sliceEnd = Math.max(lastAvailableIdx >= 0 ? lastAvailableIdx + 1 : 0, targetIndex + 1, 1);
      const monthly = FISCAL_MONTH_SEQUENCE.map((entry, idx) => ({
        month: entry.month,
        year: entry.year,
        efficiency: efficiencyByIndex[idx] || 0,
      })).slice(0, Math.min(sliceEnd, 12));

      setMonthlyEfficiency(monthly);
      const preferredIndex = getPreferredPreviousMonthIndex(monthly, selectedFiscalYear);
      setSelectedFiscalIndex(Math.min(preferredIndex, Math.max(monthly.length - 1, 0)));
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
        return employeesChart || {
          title: 'No. of Employees Who Left',
          subtitle: 'Monthly Attrition',
          labels: FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1]),
          values: Array(12).fill(0)
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
  }, [expandedChart, monthlyEfficiency, selectedFiscalIndex, industry40Chart, zeroQualityChart, monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex, onTimeDeliveryChart, zeroAccidentsChart, greenFactoryChart, employeesChart]);

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
      setSelectedSalesIndex(getPreferredPreviousMonthIndex(slicedSales, selectedFiscalYear));
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
      setSelectedProfitIndex(getPreferredPreviousMonthIndex(slicedProfit, selectedFiscalYear));
    } catch (err) {
      console.error('Failed to load Profitability data', err);
      setMonthlyProfitData([]);
    } finally {
      setProfitabilityLoading(false);
    }
  };

  return (
    <div className="space-y-2 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 min-h-screen p-0.5 sm:p-1">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-1.5 shadow-xl sm:px-5 sm:py-2">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18px 18px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}></div>
        <div className="relative flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">KMI / Global Objectives</h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Fiscal Year Selector */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-200 bg-white px-1.5 py-0.5 shadow h-7">
              <button
                onClick={() => {
                  const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
                  if (currentIndex > 0) {
                    setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
                  }
                }}
                disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
                className="rounded bg-blue-100 px-1.5 py-0 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous Fiscal Year"
                style={{ lineHeight: '1' }}
              >
                ‹
              </button>
              <span className="mr-0.5 text-[10px] font-medium text-gray-500">FY</span>
              <span className="mr-0.5 text-xs font-bold text-gray-800">
                {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
              </span>
              <span className="mr-0.5 text-[10px] text-gray-400">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
              {availableFiscalYears.length > 0 && (
                <span className="mr-0.5 text-[10px] text-gray-400">
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
                className="rounded bg-blue-100 px-1.5 py-0 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                title="Next Fiscal Year"
                style={{ lineHeight: '1' }}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Dashboard Section */}
      <div className="mt-0">
        {/* <h2 className="text-2xl text-center justify-center font-bold text-gray-800 mb-6">📊 Performance Dashboard</h2> */}
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3 lg:gap-1 lg:h-[calc(100vh-90px)] overflow-hidden">
          {/* Plant Efficiency Speedometer */}
          <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-blue-600 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => handleKPITitleClick('Plant Efficiency')}
                className="flex w-full items-center justify-center gap-1 rounded-t-xl bg-blue-100 px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-snug text-blue-900 transition-colors hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-xs"
                title="Go to Plant Efficiency KPI"
              >
                <span className="text-xs sm:text-sm">⚡</span>
                <span className="whitespace-normal break-words">Overall Plant Efficiency (OPE)</span>
              </button>
              {efficiencyLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
              ) : monthlyEfficiency && monthlyEfficiency.length > 0 ? (
                <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-4 relative w-full min-w-0 flex-1 min-h-0 overflow-hidden">
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
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Industry 4.0 Chart */}
          <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-cyan-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('Industry 4.0')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-cyan-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-cyan-900 transition-colors hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">🏭</span>
                <span className="whitespace-normal break-words">Industry 4.0</span>
              </button>
              {industry40Loading ? (
                <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
              ) : industry40Chart ? (
                <div
                  className="flex-1 min-h-0 cursor-pointer flex"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('industry40', industry40Chart)}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('industry40', industry40Chart)}
                >
                  <Industry40LineChart
                    title={industry40Chart.title}
                    labels={industry40Chart.labels}
                    actuals={industry40Chart.actuals}
                    showHeader={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Zero Quality Complaints Chart */}
          <div className="w-full h-full min-h-0 lg:col-span-4 lg:row-span-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-emerald-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('Zero Quality')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-emerald-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-emerald-900 transition-colors hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">✅</span>
                <span className="whitespace-normal break-words">Zero Quality Complaints</span>
              </button>
              {zeroQualityLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500 text-sm">Loading...</div>
              ) : zeroQualityChart ? (
                <div
                  className="flex-1 min-h-0 cursor-pointer flex"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('zeroQuality', zeroQualityChart)}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('zeroQuality', zeroQualityChart)}
                >
                  <Industry40LineChart
                    title={zeroQualityChart.title}
                    labels={zeroQualityChart.labels}
                    actuals={zeroQualityChart.actuals}
                    showHeader={false}
                    allowDecimals={false}
                    unit=""
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Revenue and Profitability Split Chart */}
          <div className="w-full h-full min-h-0 lg:col-span-6 lg:row-span-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500 bg-white shadow-lg">
              {/* Group Title */}
              <button
                onClick={() => handleKPITitleClick('Cost')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-amber-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-amber-900 transition-colors hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">💰</span>
                <span className="whitespace-normal break-words">Cost</span>
              </button>
              <div className="flex flex-col md:flex-row h-full flex-1">
                {/* Revenue Section */}
                <div className="flex-1 px-0 pb-0 pt-0 md:px-0 md:pb-0 md:pt-0 flex flex-col md:border-r border-gray-200 min-w-0 h-full">
                  <button
                    onClick={() => handleKPITitleClick('Revenue')}
                    className="text-[10px] md:text-xs font-bold text-gray-500 mb-0 text-center tracking-wide hover:text-blue-600 transition-colors cursor-pointer px-1.5 md:px-2 py-0.5 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    REVENUE
                  </button>
                  {salesLoading ? (
                    <div className="flex items-center justify-center p-1 md:p-2 text-gray-500 text-xs">Loading...</div>
                  ) : monthlySalesData && monthlySalesData.length > 0 ? (
                    (() => {
                      const activeIdx = Math.min(Math.max(selectedSalesIndex, 0), monthlySalesData.length - 1);
                      const salesData = monthlySalesData[activeIdx] || { actual: 0, target: 0 };
                      const actual = Number(salesData.actual || 0);
                      const target = Number(salesData.target || 0);
                      const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
                      return (
                        <div className="flex flex-col items-center flex-1 min-w-0 justify-center h-full cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                          onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                        >
                          <h5 className="text-[9px] md:text-[10px] font-bold text-gray-800 mb-0 whitespace-nowrap">
                            {MONTH_LABELS[(salesData.month || 1) - 1]} {salesData.year || ''}
                          </h5>
                          <div className="flex items-center justify-center min-h-0 w-full relative" style={{ height: '100%' }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <div className="text-sm md:text-base font-extrabold text-blue-900 leading-tight text-center px-1">{formatINR(actual)}</div>
                              <div className="text-[10px] md:text-[11px] font-semibold text-gray-500 leading-tight text-center px-1">of {formatINR(target)}</div>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Pie
                                  data={[
                                    { name: 'Achieved', value: Math.max(pct, 0.0001) },
                                    { name: 'Remaining', value: Math.max(100 - pct, 0.0001) },
                                  ]}
                                  dataKey="value"
                                  innerRadius="65%"
                                  outerRadius="100%"
                                  startAngle={90}
                                  endAngle={-270}
                                  stroke="none"
                                  isAnimationActive={false}
                                >
                                  <Cell fill="#0d47a1" />
                                  <Cell fill="#e2e8f0" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-xs font-medium">No data</div>
                  )}
                </div>

                {/* Profitability Section */}
                <div className="flex-1 px-0 pb-0 pt-0 md:px-0 md:pb-0 md:pt-0 flex flex-col border-t md:border-t-0 min-w-0 h-full">
                  <button
                    onClick={() => handleKPITitleClick('Profitability')}
                    className="text-[10px] md:text-xs font-bold text-gray-500 mb-0 text-center tracking-wide hover:text-blue-600 transition-colors cursor-pointer px-1.5 md:px-2 py-0.5 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    PROFITABILITY (YTD)
                  </button>
                  {profitabilityLoading ? (
                    <div className="flex items-center justify-center p-1 md:p-2 text-gray-500 text-xs">Loading...</div>
                  ) : monthlyProfitData && monthlyProfitData.length > 0 ? (
                    (() => {
                      const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                      const profit = profitData.profit;
                      const target = profitData.target;
                      const percentageAchieved = target > 0 ? Math.min((profit / target) * 100, 100) : 0;
                      return (
                        <div className="flex flex-col items-center flex-1 min-w-0 justify-center h-full cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                          onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('salesProfit', { monthlySalesData, selectedSalesIndex, monthlyProfitData, selectedProfitIndex })}
                        >
                          <h5 className="text-[9px] md:text-[10px] font-bold text-gray-800 mb-0 whitespace-nowrap">
                            {MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}
                          </h5>
                          <div className="flex items-center justify-center min-h-0 w-full relative" style={{ height: '100%' }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                              <div className="text-sm md:text-base font-extrabold text-green-800 leading-tight text-center px-1">{profit.toFixed(1)}%</div>
                              <div className="text-[10px] md:text-[11px] font-semibold text-gray-500 leading-tight text-center px-1">of {target.toFixed(1)}%</div>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Pie
                                  data={[
                                    { name: 'Achieved', value: Math.max(percentageAchieved, 0.0001) },
                                    { name: 'Remaining', value: Math.max(100 - percentageAchieved, 0.0001) },
                                  ]}
                                  dataKey="value"
                                  innerRadius="65%"
                                  outerRadius="100%"
                                  startAngle={90}
                                  endAngle={-270}
                                  stroke="none"
                                  isAnimationActive={false}
                                >
                                  <Cell fill="#15803d" />
                                  <Cell fill="#e2e8f0" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-xs font-medium">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Cost (col-span-3) + On Time Delivery (col-span-3) */}
          {/* On Time Delivery */}
          <div className="w-full h-full min-h-0 lg:col-span-6 lg:row-span-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-violet-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('On Time Delivery')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-violet-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-violet-900 transition-colors hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">🚚</span>
                <span className="whitespace-normal break-words">On Time Delivery</span>
              </button>
              {onTimeDeliveryLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
              ) : onTimeDeliveryChart ? (
                <div
                  className="flex-1 min-h-0 cursor-pointer flex"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('onTimeDelivery', onTimeDeliveryChart)}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('onTimeDelivery', onTimeDeliveryChart)}
                >
                  <OnTimeDeliveryBarChart title={onTimeDeliveryChart.title} subtitle={onTimeDeliveryChart.subtitle} labels={onTimeDeliveryChart.labels} actuals={onTimeDeliveryChart.actuals} targets={onTimeDeliveryChart.targets} showHeader={false} />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Row 3: Zero Accidents, Green Factory, Morale (each col-span-2) */}
          {/* Zero Accidents */}
          <div className="w-full h-full min-h-0 lg:col-span-3">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-rose-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('Zero Accidents')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-rose-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-rose-900 transition-colors hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">🦺</span>
                <span className="whitespace-normal break-words">Zero Accidents</span>
              </button>
              {zeroAccidentsLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
              ) : zeroAccidentsChart ? (
                <div
                  className="flex-1 min-h-0 cursor-pointer flex"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('zeroAccidents', zeroAccidentsChart)}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('zeroAccidents', zeroAccidentsChart)}
                >
                  <ZeroAccidentsBarChart title={zeroAccidentsChart.title} subtitle={zeroAccidentsChart.subtitle} labels={zeroAccidentsChart.labels} actuals={zeroAccidentsChart.actuals} showHeader={false} />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Green Factory */}
          <div className="w-full h-full min-h-0 lg:col-span-3">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-green-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('Green Factory')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-green-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-green-900 transition-colors hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">🌿</span>
                <span className="whitespace-normal break-words">Green Factory</span>
              </button>
              {greenFactoryLoading ? (
                <div className="flex items-center justify-center p-8 text-gray-500">Loading...</div>
              ) : greenFactoryChart ? (
                <div
                  className="flex-1 min-h-0 cursor-pointer flex"
                  role="button"
                  tabIndex={0}
                  onClick={() => openExpandedChart('greenFactory', greenFactoryChart)}
                  onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('greenFactory', greenFactoryChart)}
                >
                  <GreenFactoryBarChart title={greenFactoryChart.title} subtitle={greenFactoryChart.subtitle} labels={greenFactoryChart.labels} values={greenFactoryChart.values} showHeader={false} />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-sm font-medium">No data</div>
              )}
            </div>
          </div>

          {/* Morale */}
          <div className="w-full h-full min-h-0 lg:col-span-6">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-pink-500 bg-white shadow-lg">
              <button
                onClick={() => handleKPITitleClick('Morale')}
                className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-pink-100 px-2 py-1 text-center text-xs font-extrabold leading-snug text-pink-900 transition-colors hover:bg-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 sm:text-sm"
              >
                <span className="text-sm sm:text-base">😊</span>
                <span className="whitespace-normal break-words">Morale</span>
              </button>
              <div className="flex-1 px-1 pb-1 pt-0.5 min-w-0">
                {employeesChartLoading ? (
                  <div className="flex items-center justify-center p-2 text-gray-500 text-xs">Loading...</div>
                ) : (
                  <div
                    className="h-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => openExpandedChart('themeEmployees', employeesChart)}
                    onKeyDown={(e) => e.key === 'Enter' && openExpandedChart('themeEmployees', employeesChart)}
                  >
                    {employeesChart ? (
                      <Box4EmployeesLineChart title={employeesChart.title} subtitle={employeesChart.subtitle} labels={employeesChart.labels} values={employeesChart.values} showHeader={false} showSubtitle={true} />
                    ) : (
                      <div className="flex items-center justify-center flex-1 h-full min-h-0 text-gray-500 text-xs font-medium">No data</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Performance Dashboard Section End */}

      <div className="mt-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-3 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18px 18px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}></div>
          <h2 className="relative text-lg font-extrabold tracking-tight text-white sm:text-xl">Department KPI Dashboard</h2>
        </div>
        <div className="mt-1">
          <DepartmentPerformanceRadarChart
            departments={departmentPerformanceForChart}
            onDepartmentClick={(department) => {
              if (department?.id) {
                navigate(`/management/department/${department.id}`);
              }
            }}
          />
        </div>
      </div>

      {/* Staff Performance Section */}
      <div className="mt-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-3 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18px 18px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}></div>
          <h2 className="relative text-lg font-extrabold tracking-tight text-white sm:text-xl">Staff Performance</h2>
        </div>
        <div className="mt-1">
          <StaffPerformanceList staffList={staffList} loading={staffPerformanceLoading} />
        </div>
      </div>

      {/* Pillars Section */}
      <div className="mt-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-3 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18px 18px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}></div>
          <h2 className="relative text-lg font-extrabold tracking-tight text-white sm:text-xl">Pillars</h2>
        </div>
        <div className="mt-1">
          <PillarRadarChart
            pillars={[...pillerStats.pillers].sort((a, b) => (a.piller_name || '').localeCompare(b.piller_name || ''))}
            onPillarClick={(pillar) => {
              if (pillar?.id) {
                navigate(`/management/pillar/${pillar.id}`);
              }
            }}
          />
        </div>
      </div>
      {/* Pillars Section End*/}



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
                <div className="flex flex-col items-center justify-center gap-6 w-full">
                  <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
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
                      className="relative z-30 px-4 py-3 sm:px-6 sm:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg text-xl sm:text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md hover:scale-105 active:scale-95"
                      title="Previous Month"
                    >
                      ‹
                    </button>
                    <div className="flex-1 min-w-0 flex items-center justify-center">
                      <div className="w-full max-w-3xl" style={{ aspectRatio: '300/220' }}>
                        <SpeedometerGauge
                          efficiency={(expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.efficiency || 0}
                          month={MONTH_LABELS[((expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.month || 1) - 1]}
                          year={(expandedChartData?.monthlyEfficiency || monthlyEfficiency)[expandedChartData?.selectedFiscalIndex !== undefined ? expandedChartData.selectedFiscalIndex : selectedFiscalIndex]?.year || ''}
                        />
                      </div>
                    </div>
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
                      className="relative z-30 px-4 py-3 sm:px-6 sm:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg text-xl sm:text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md hover:scale-105 active:scale-95"
                      title="Next Month"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}

              {expandedChart === 'industry40' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  isExpanded={true}
                />
              )}

              {expandedChart === 'zeroQuality' && (
                <Industry40LineChart
                  title={expandedChartData.title}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
                  isExpanded={true}
                  allowDecimals={false}
                  unit=""
                />
              )}

              {expandedChart === 'zeroAccidents' && (
                <ZeroAccidentsBarChart
                  title={expandedChartData.title}
                  subtitle={expandedChartData.subtitle}
                  labels={expandedChartData.labels}
                  actuals={expandedChartData.actuals}
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
                <div className="flex items-center justify-center w-full h-full">
                  <div className="bg-gray-50 rounded-xl p-8 border border-gray-100 shadow-sm flex flex-col h-full w-full max-w-4xl">
                    <div className="flex-1 min-h-0">
                      <Box4EmployeesLineChart
                        title={expandedChartData?.title || 'No. of Employees Who Left'}
                        labels={expandedChartData?.labels || FISCAL_MONTH_SEQUENCE.map(e => MONTH_LABELS[e.month - 1])}
                        values={expandedChartData?.values || Array(12).fill(0)}
                        isExpanded={true}
                      />
                    </div>
                  </div>
                </div>
              )}

              {expandedChart === 'salesProfit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                  <div className="flex flex-col justify-center rounded-xl border border-gray-100 p-8 shadow-sm">
                    <h4 className="font-semibold text-xl mb-6 text-center">Revenue</h4>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-transform hover:scale-105 active:scale-95"
                        onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === 0 ? monthlySalesData.length - 1 : selectedSalesIndex - 1); }}
                        disabled={!monthlySalesData.length}
                      >
                        ‹
                      </button>
                      <div className="flex flex-col items-center">
                        <h5 className="text-lg font-bold text-gray-800 mb-4">
                          {MONTH_LABELS[(monthlySalesData[selectedSalesIndex]?.month || 1) - 1]} {monthlySalesData[selectedSalesIndex]?.year || ''}
                        </h5>
                        <div className="flex items-center justify-center" style={{ width: 280, height: 280 }}>
                          {(() => {
                            const salesData = monthlySalesData[selectedSalesIndex] || { actual: 0, target: 0 };
                            const actual = Number(salesData.actual || 0);
                            const target = Number(salesData.target || 0);
                            const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
                            return (
                              <div className="relative w-full h-full">
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                  <div className="text-2xl md:text-3xl font-extrabold text-blue-900 leading-tight text-center px-2">{formatINR(actual)}</div>
                                  <div className="text-xs md:text-sm font-semibold text-gray-500 leading-tight text-center px-2">of {formatINR(target)}</div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'Achieved', value: Math.max(pct, 0.0001) },
                                        { name: 'Remaining', value: Math.max(100 - pct, 0.0001) },
                                      ]}
                                      dataKey="value"
                                      innerRadius="68%"
                                      outerRadius="100%"
                                      startAngle={90}
                                      endAngle={-270}
                                      stroke="none"
                                      isAnimationActive={false}
                                    >
                                      <Cell fill="#0d47a1" />
                                      <Cell fill="#e2e8f0" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col gap-2 mt-6">
                          <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                            <span className="w-4 h-4 bg-[#0d47a1] rounded"></span>
                            <span>Actual: {formatINR(monthlySalesData[selectedSalesIndex]?.actual)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                            <span className="w-4 h-4 bg-[#0d47a1] rounded"></span>
                            <span>Target: {formatINR(monthlySalesData[selectedSalesIndex]?.target)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-transform hover:scale-105 active:scale-95"
                        onClick={(e) => { e.stopPropagation(); if (!monthlySalesData.length) return; setSelectedSalesIndex(selectedSalesIndex === monthlySalesData.length - 1 ? 0 : selectedSalesIndex + 1); }}
                        disabled={!monthlySalesData.length}
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl border border-gray-100 p-8 shadow-sm">
                    <h4 className="font-semibold text-xl mb-6 text-center">Profitability</h4>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-transform hover:scale-105 active:scale-95"
                        onClick={(e) => { e.stopPropagation(); if (!monthlyProfitData.length) return; setSelectedProfitIndex(selectedProfitIndex === 0 ? monthlyProfitData.length - 1 : selectedProfitIndex - 1); }}
                        disabled={!monthlyProfitData.length}
                      >
                        ‹
                      </button>
                      <div className="flex flex-col items-center">
                        <h5 className="text-lg font-bold text-gray-800 mb-4">
                          {MONTH_LABELS[(monthlyProfitData[selectedProfitIndex]?.month || 1) - 1]} {monthlyProfitData[selectedProfitIndex]?.year || ''}
                        </h5>
                        <div className="flex items-center justify-center" style={{ width: 280, height: 280 }}>
                          {(() => {
                            const profitData = monthlyProfitData[selectedProfitIndex] || { profit: 0, target: 100 };
                            const profit = profitData.profit;
                            const target = profitData.target;
                            const pct = target > 0 ? Math.min((profit / target) * 100, 100) : 0;
                            return (
                              <div className="relative w-full h-full">
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                  <div className="text-2xl md:text-3xl font-extrabold text-green-800 leading-tight text-center px-2">{profit.toFixed(1)}%</div>
                                  <div className="text-xs md:text-sm font-semibold text-gray-500 leading-tight text-center px-2">of {target.toFixed(1)}%</div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'Achieved', value: Math.max(pct, 0.0001) },
                                        { name: 'Remaining', value: Math.max(100 - pct, 0.0001) },
                                      ]}
                                      dataKey="value"
                                      innerRadius="68%"
                                      outerRadius="100%"
                                      startAngle={90}
                                      endAngle={-270}
                                      stroke="none"
                                      isAnimationActive={false}
                                    >
                                      <Cell fill="#15803d" />
                                      <Cell fill="#e2e8f0" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col gap-2 mt-6">
                          <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                            <span className="w-4 h-4 bg-[#15803d] rounded"></span>
                            <span>Actual: {(monthlyProfitData[selectedProfitIndex]?.profit || 0).toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                            <span className="w-4 h-4 bg-[#15803d] rounded"></span>
                            <span>Target: {(monthlyProfitData[selectedProfitIndex]?.target || 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="bg-gray-100 border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center text-2xl text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-transform hover:scale-105 active:scale-95"
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