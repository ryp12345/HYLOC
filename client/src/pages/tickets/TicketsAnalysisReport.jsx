import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTicketReports } from '../../api/ticketApi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  LabelList,
} from 'recharts';

const MONTH_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const getCurrentFiscalYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  return currentMonth < 3 ? currentYear - 1 : currentYear;
};

const AVAILABLE_FISCAL_YEARS = Array.from({ length: 6 }, (_, i) => getCurrentFiscalYear() - 2 + i);

const STATUS_COLORS = {
  open: '#3b82f6',
  assigned: '#6366f1',
  'in progress': '#8b5cf6',
  pending: '#f59e0b',
  rejected: '#ef4444',
  closed: '#6b7280',
  resolved: '#10b981',
  unknown: '#9ca3af',
};

const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7f1d1d',
};

const COLORS_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#6b7280'];

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

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const EmptyState = ({ message, linkTo, linkText }) => (
  <div className="bg-white rounded-2xl shadow p-12 text-center">
    <p className="text-gray-400 text-lg">{message}</p>
    {linkTo && <Link to={linkTo} className="inline-block mt-4 text-blue-600 hover:underline">{linkText}</Link>}
  </div>
);

const KpiCard = ({ label, value, icon, borderColor = 'border-blue-500' }) => (
  <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${borderColor}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-gray-500 text-xs font-semibold">{label}</div>
      <div className="text-2xl">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-gray-800">{value}</div>
  </div>
);

const SectionCard = ({ title, subtitle, children, className = '', headerColor = 'bg-blue-100', headerText = 'text-blue-900', borderColor = 'border-blue-500' }) => (
  <div className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 ${borderColor} bg-white shadow-lg ${className}`}>
    <div className={`flex w-full items-center justify-center gap-1.5 rounded-t-xl ${headerColor} px-2 py-1 text-center text-[10px] font-extrabold leading-snug ${headerText} transition-colors sm:text-xs`}>
      {title && <span className="whitespace-normal break-words">{title}</span>}
      {subtitle && <span className="text-[10px] font-medium opacity-80">{subtitle}</span>}
    </div>
    <div className="flex-1 min-h-0 p-1.5 sm:p-2">
      {children}
    </div>
  </div>
);

export default function TicketsAnalysisReport() {
  const { user } = useAuth();
  const roleName = String(user?.role || '').toLowerCase();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getTicketReports(selectedFiscalYear);
      setReport(res.data?.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load ticket reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFiscalYear]);

  const formattedFiscalYear = useMemo(() => {
    return `FY ${selectedFiscalYear} – ${selectedFiscalYear + 1}`;
  }, [selectedFiscalYear]);

  const statusChartData = useMemo(() => {
    if (!report?.status_distribution) return [];
    return Object.entries(report.status_distribution)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: STATUS_COLORS[name.toLowerCase()] || '#9ca3af',
      }))
      .filter((d) => d.value > 0);
  }, [report]);

  const priorityChartData = useMemo(() => {
    if (!report?.priority_distribution) return [];
    return Object.entries(report.priority_distribution)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: PRIORITY_COLORS[name.toLowerCase()] || '#9ca3af',
      }))
      .filter((d) => d.value > 0);
  }, [report]);

  const departmentChartData = useMemo(() => {
    if (!report?.department_breakdown) return [];
    return Object.entries(report.department_breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [report]);

  const topCreatorsData = useMemo(() => {
    if (!report?.top_creators) return [];
    return report.top_creators.slice(0, 8);
  }, [report]);

  const assigneeBreakdownData = useMemo(() => {
    if (!report?.assignee_breakdown) return [];
    return report.assignee_breakdown
      .filter((a) => a.name && a.name !== 'Unknown')
      .sort((a, b) => (b.overdue_count || 0) - (a.overdue_count || 0))
      .slice(0, 10);
  }, [report]);

  const openAgingData = useMemo(() => {
    if (!report?.open_aging) return [];
    return Object.entries(report.open_aging).map(([name, value]) => ({ name, value }));
  }, [report]);

  const monthlyTrends = useMemo(() => {
    const raw = report?.monthly_trends || [];
    return raw.map((item) => ({
      ...item,
      monthLabel: MONTH_LABELS[Number(item.month.split('-')[1]) - 4] || item.month,
    }));
  }, [report]);

  const hasData = report && report.summary && report.summary.total_tickets > 0;
  const { summary } = report || {};
  const overdueCount = summary?.overdue_tickets || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ticket reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Failed to load reports</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadData} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-0 sm:px-1 lg:px-2">
      {/* Header */}
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-3 shadow-xl sm:px-5 sm:py-3">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18px 18px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}></div>
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Ticket Analysis Reports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wider border border-white/30">
              {roleName === 'management' ? 'Management View' : roleName === 'hod' ? 'HOD View' : 'View'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/tickets"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              ← Ticket Dashboard
            </Link>
            {/* Fiscal Year Selector */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-200 bg-white px-1.5 py-0.5 shadow h-7">
              <button
                onClick={() => {
                  const currentIndex = AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear);
                  if (currentIndex > 0) {
                    setSelectedFiscalYear(AVAILABLE_FISCAL_YEARS[currentIndex - 1]);
                  }
                }}
                disabled={AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear) <= 0}
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
              <button
                onClick={() => {
                  const currentIndex = AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear);
                  if (currentIndex >= 0 && currentIndex < AVAILABLE_FISCAL_YEARS.length - 1) {
                    setSelectedFiscalYear(AVAILABLE_FISCAL_YEARS[currentIndex + 1]);
                  }
                }}
                disabled={AVAILABLE_FISCAL_YEARS.indexOf(selectedFiscalYear) >= AVAILABLE_FISCAL_YEARS.length - 1}
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

      {!hasData && <EmptyState message="No ticket data available for report generation." linkTo="/tickets" linkText="Go to Ticket Dashboard →" />}

      {hasData && (
        <div className="flex flex-col gap-1.5 lg:-mt-1">
          {/* Chart Rows */}
          <div className="grid grid-cols-1 gap-1.5 lg:min-h-[260px]">
            {/* Row 1: Status + Priority (+ Department for management only) */}
            <div className={`grid min-h-[260px] grid-cols-1 ${roleName === 'management' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-1.5`}>
              <SectionCard title="Ticket Status Distribution" headerColor="bg-blue-100" headerText="text-blue-900" borderColor="border-blue-500">
                {statusChartData.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            paddingAngle={2}
                            stroke="#ffffff"
                            strokeWidth={2}
                          >
                            {statusChartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No status data available.</p>
                )}
              </SectionCard>

              <SectionCard title="Ticket Priority Distribution" headerColor="bg-amber-100" headerText="text-amber-900" borderColor="border-amber-500">
                {priorityChartData.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={priorityChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="priorityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#d97706" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="value" fill="url(#priorityGrad)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#92400e', fontWeight: 700 }} />
                            {priorityChartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No priority data available.</p>
                )}
              </SectionCard>

              {roleName === 'management' && (
                <SectionCard title="Department Distribution" headerColor="bg-cyan-100" headerText="text-cyan-900" borderColor="border-cyan-500">
                  {departmentChartData.length > 0 ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={departmentChartData} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#475569' }} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: '#475569' }} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
                              {departmentChartData.map((entry, index) => (
                                <Cell key={entry.name} fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-sm mt-4">No department data available.</p>
                  )}
                </SectionCard>
              )}
            </div>

            {/* Row 2: Assignee Performance + Overdue Details */}
            <div className="grid grid-cols-1 gap-1.5 lg:min-h-[300px] lg:grid-cols-2">
              <SectionCard title="Assignee Performance" subtitle="Assigned vs Overdue" headerColor="bg-emerald-100" headerText="text-emerald-900" borderColor="border-emerald-500">
                {assigneeBreakdownData.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={assigneeBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} interval={0} angle={-30} textAnchor="end" height={40} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#475569' }} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                          <Bar dataKey="assigned_count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Assigned" />
                          <Bar dataKey="overdue_count" fill="#ef4444" radius={[3, 3, 0, 0]} name="Overdue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No assignee data available.</p>
                )}
              </SectionCard>

              <SectionCard title="Overdue Ticket Details" subtitle={`${(report?.overdue_table || []).length} overdue`} headerColor="bg-red-100" headerText="text-red-900" borderColor="border-red-500">
                {(report?.overdue_table || []).length > 0 ? (
                  <div className="h-full min-h-0 overflow-hidden">
                    <div className="h-[240px] overflow-x-auto overflow-y-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">S.No</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">Title</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">Priority</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">Department</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">Due Date</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-bold text-red-700 uppercase tracking-wider">Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(report?.overdue_table || []).map((t, idx) => (
                            <tr key={t.id} className="hover:bg-red-50/50 transition">
                              <td className="px-2 py-1.5 font-medium text-gray-900 text-xs">{idx + 1}</td>
                              <td className="px-2 py-1.5 text-gray-700 text-xs max-w-[160px] truncate">{t.title || '—'}</td>
                              <td className="px-2 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${(String(t.priority || '').toLowerCase() === 'high' || String(t.priority || '').toLowerCase() === 'critical')
                                  ? 'bg-red-100 text-red-700'
                                  : String(t.priority || '').toLowerCase() === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                  }`}>
                                  {t.priority || '—'}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-600 text-xs">{t.department || '—'}</td>
                              <td className="px-2 py-1.5 text-gray-600 text-xs">{formatDate(t.due_date)}</td>
                              <td className="px-2 py-1.5">
                                <span className={`font-bold text-xs ${t.overdue_days > 7 ? 'text-red-600' : 'text-orange-600'}`}>
                                  {t.overdue_days}d
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-green-600 text-sm font-medium mb-0.5">No overdue tickets</p>
                    <p className="text-gray-400 text-xs">All tickets are within due dates or closed.</p>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Row 3: Monthly + Aging */}
            <div className="grid grid-cols-1 gap-1.5 lg:min-h-[290px] lg:grid-cols-2">
              <SectionCard title={`Monthly Ticket Volume — ${formattedFiscalYear}`} headerColor="bg-indigo-100" headerText="text-indigo-900" borderColor="border-indigo-500">
                {monthlyTrends.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[230px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyTrends} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#475569' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#475569' }} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                          <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                          <Bar dataKey="Open" fill="url(#openGrad)" radius={[2, 2, 0, 0]} name="Open" />
                          <Bar dataKey="Closed" fill="#22c55e" radius={[2, 2, 0, 0]} name="Closed" />
                          <Bar dataKey="Rejected" fill="#ef4444" radius={[2, 2, 0, 0]} name="Rejected" />
                          <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2, fill: '#0ea5e9' }} name="Total" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No monthly trend data available.</p>
                )}
              </SectionCard>

              <SectionCard title="Open Ticket Aging" headerColor="bg-violet-100" headerText="text-violet-900" borderColor="border-violet-500">
                {openAgingData.length > 0 && openAgingData.some((d) => d.value > 0) ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[230px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={openAgingData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#475569' }} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                            {openAgingData.map((entry) => (
                              <Cell key={entry.name}
                                fill={
                                  entry.name === '7+ days' ? '#ef4444' :
                                    entry.name === '3-7 days' ? '#f59e0b' :
                                      entry.name === '1-3 days' ? '#6366f1' :
                                        '#3b82f6'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No open tickets to display aging data.</p>
                )}
              </SectionCard>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 gap-2 mb-3 md:grid-cols-4">
              <KpiCard label="Total Tickets" value={summary.total_tickets} icon="🎫" borderColor="border-blue-500" />
              <KpiCard label="Open Tickets" value={summary.open_tickets} icon="📋" borderColor="border-amber-500" />
              <KpiCard label="Closed / Rejected" value={summary.closed_tickets} icon="✅" borderColor="border-emerald-500" />
              <KpiCard label="Overdue Tickets" value={overdueCount} icon="⚠️" borderColor="border-rose-500" />
            </div>

            {/* Secondary KPI Row */}
            <div className="grid grid-cols-2 gap-2 mb-3 md:grid-cols-4">
              {report?.status_distribution?.pending > 0 && (
                <KpiCard label="Pending Tickets" value={report.status_distribution.pending} icon="⏳" borderColor="border-yellow-500" />
              )}
              {summary?.total_tickets > 0 && (
                <KpiCard label="Resolution Rate" value={Math.round((summary.closed_tickets / summary.total_tickets) * 100) + '%'} icon="📊" borderColor="border-emerald-500" />
              )}
              {departmentChartData.length > 0 && (
                <KpiCard label="Top Department" value={departmentChartData[0].name} icon="🏢" borderColor="border-cyan-500" />
              )}
              {topCreatorsData.length > 0 && (
                <KpiCard label="Top Contributor" value={topCreatorsData[0].dept || '—'} icon="👤" borderColor="border-orange-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
