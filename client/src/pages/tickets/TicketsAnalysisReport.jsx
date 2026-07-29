import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTicketReports } from '../../api/ticketApi';
import ExcelJS from 'exceljs';
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
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label != null && <div className="mb-1 font-bold text-[color:var(--text-primary)]">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color || p.stroke || p.fill }}></span>
          <span className="font-bold text-[color:var(--text-secondary)]">{p.name}:</span>
          <span className="font-bold text-[color:var(--text-primary)]">{p.value}</span>
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
  <div className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl shadow p-12 text-center">
    <p className="text-[color:var(--text-secondary)] text-lg">{message}</p>
    {linkTo && <Link to={linkTo} className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline">{linkText}</Link>}
  </div>
);

const KpiCard = ({ label, value, icon, borderColor = 'border-blue-500' }) => (
  <div className={`bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow p-4 border-l-4 ${borderColor}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-[color:var(--text-secondary)] text-xs font-semibold">{label}</div>
      <div className="text-2xl">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-[color:var(--text-primary)]">{value}</div>
  </div>
);

const SectionCard = ({ title, subtitle, children, className = '', headerColor = 'bg-blue-100 dark:bg-blue-900/40', headerText = 'text-blue-900 dark:text-blue-300', borderColor = 'border-blue-500 dark:border-blue-700' }) => (
  <div className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 ${borderColor} bg-[color:var(--surface)] shadow-lg ${className}`}>
    <div className={`flex w-full items-center justify-center gap-1.5 rounded-t-xl ${headerColor} px-2 py-1 text-center text-xs font-extrabold leading-snug ${headerText} transition-colors sm:text-sm`}>
      {title && <span className="whitespace-normal break-words">{title}</span>}
      {subtitle && <span className="text-[10px] font-medium opacity-80">{subtitle}</span>}
    </div>
    <div className="flex-1 min-h-0 p-2 sm:p-3">
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

  const assigneeBreakdownData = useMemo(() => {
    if (!report?.assignee_breakdown) return [];
    const filtered = report.assignee_breakdown
      .filter((a) => a.name && a.name !== 'Unknown')
      .sort((a, b) => (b.overdue_count || 0) - (a.overdue_count || 0));
    const top = filtered.slice(0, 8);
    const others = filtered.slice(8);
    if (others.length > 0) {
      const othersAssigned = others.reduce((sum, a) => sum + (a.assigned_count || 0), 0);
      const othersOverdue = others.reduce((sum, a) => sum + (a.overdue_count || 0), 0);
      top.push({ name: 'Others', assigned_count: othersAssigned, overdue_count: othersOverdue });
    }
    return top;
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

  const exportToExcel = async () => {
    if (!report || !hasData) return;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'HYLOC Management System';
    wb.created = new Date();

    const addSheet = (name, data, columns) => {
      if (!data || data.length === 0) return;
      const ws = wb.addWorksheet(name);

      ws.mergeCells(1, 1, 1, columns.length);
      const headerCell = ws.getCell(1, 1);
      headerCell.value = 'Hyloc Hydrotechnic Pvt Ltd';
      headerCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1e40af' } };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFe0e7ff' }
      };
      ws.getRow(1).height = 28;

      const titleRow = ws.getRow(2);
      titleRow.values = columns.map(c => c.header);
      titleRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3b82f6' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
      ws.getRow(2).height = 22;

      data.forEach((row, idx) => {
        const wsRow = ws.getRow(idx + 3);
        columns.forEach((col, colIdx) => {
          const cell = wsRow.getCell(colIdx + 1);
          cell.value = row[col.key] ?? '';
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
      });

      columns.forEach((_, idx) => {
        ws.getColumn(idx + 1).width = Math.max(12, columns[idx].width || 18);
      });
    };

    const summaryColumns = [
      { header: 'S.No', key: 'SNo', width: 8 },
      { header: 'Metric', key: 'Metric', width: 24 },
      { header: 'Value', key: 'Value', width: 16 },
    ];
    const summaryData = [
      { Metric: 'Total Tickets', Value: summary?.total_tickets || 0 },
      { Metric: 'Open Tickets', Value: summary?.open_tickets || 0 },
      { Metric: 'Closed', Value: summary?.closed_tickets || 0 },
      { Metric: 'Overdue Tickets', Value: overdueCount },
      { Metric: 'Pending Tickets', Value: report?.status_distribution?.pending || 0 },
      { Metric: 'Resolution Rate', Value: summary?.total_tickets > 0 ? `${Math.round((summary.closed_tickets / summary.total_tickets) * 100)}%` : '0%' },
    ].map((item, idx) => ({ SNo: idx + 1, ...item }));
    addSheet('Summary', summaryData, summaryColumns);

    const priorityColumns = [
      { header: 'S.No', key: 'SNo', width: 8 },
      { header: 'Priority', key: 'Priority', width: 18 },
      { header: 'Count', key: 'Count', width: 12 },
    ];
    const priorityData = Object.entries(report.priority_distribution || {}).map(([name, value], idx) => ({
      SNo: idx + 1,
      Priority: name.charAt(0).toUpperCase() + name.slice(1),
      Count: value,
    }));
    addSheet('Priority Distribution', priorityData, priorityColumns);

    const deptColumns = [
      { header: 'S.No', key: 'SNo', width: 8 },
      { header: 'Department', key: 'Department', width: 28 },
      { header: 'Count', key: 'Count', width: 12 },
    ];
    const deptData = Object.entries(report.department_breakdown || {}).map(([name, value], idx) => ({
      SNo: idx + 1,
      Department: name,
      Count: value,
    }));
    addSheet('Department Breakdown', deptData, deptColumns);

    const assigneeColumns = [
      { header: 'S.No', key: 'SNo', width: 8 },
      { header: 'Assignee', key: 'Assignee', width: 24 },
      { header: 'Assigned', key: 'Assigned', width: 12 },
      { header: 'Overdue', key: 'Overdue', width: 12 },
    ];
    const assigneeData = (report.assignee_breakdown || [])
      .filter((a) => a.name && a.name !== 'Unknown')
      .map((a, idx) => ({
        SNo: idx + 1,
        Assignee: a.name,
        Assigned: a.assigned_count || 0,
        Overdue: a.overdue_count || 0,
      }));
    addSheet('Assignee Performance', assigneeData, assigneeColumns);

    const monthlyColumns = [
      { header: 'S.No', key: 'SNo', width: 8 },
      { header: 'Month', key: 'Month', width: 14 },
      { header: 'Open', key: 'Open', width: 10 },
      { header: 'Closed', key: 'Closed', width: 10 },
      { header: 'Total', key: 'Total', width: 10 },
    ];
    const monthlyData = (report.monthly_trends || []).map((item, idx) => ({
      SNo: idx + 1,
      Month: item.month,
      Open: item.Open || 0,
      Closed: item.Closed || 0,
      Total: item.total || 0,
    }));
    addSheet('Monthly Trends', monthlyData, monthlyColumns);

    const overdueColumns = [
      { header: 'S.No', key: 'S.No', width: 8 },
      { header: 'Title', key: 'Title', width: 32 },
      { header: 'Priority', key: 'Priority', width: 12 },
      { header: 'Department', key: 'Department', width: 20 },
      { header: 'Due Date', key: 'Due Date', width: 14 },
      { header: 'Overdue Days', key: 'Overdue Days', width: 14 },
    ];
    const overdueData = (report.overdue_table || []).map((t, idx) => ({
      'S.No': idx + 1,
      Title: t.title || '—',
      Priority: t.priority || '—',
      Department: t.department || '—',
      'Due Date': t.due_date ? formatDate(t.due_date) : '—',
      'Overdue Days': t.overdue_days || 0,
    }));
    addSheet('Overdue Tickets', overdueData, overdueColumns);

    if (wb.worksheets.length > 0) {
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ticket_report_${selectedFiscalYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

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
    <div className="w-full max-w-none bg-[color:var(--app-bg)] px-0 sm:px-1 lg:px-2">
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
            <button
              onClick={exportToExcel}
              disabled={!hasData || loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⬇ Download Report
            </button>
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
        <div className="flex flex-col gap-3">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 gap-2 items-stretch md:grid-cols-4">
            <div className="rounded-xl border-l-4 border-blue-500 dark:border-blue-600 bg-[color:var(--surface)] p-3 shadow-sm border border-[color:var(--border)]">
              <div className="text-[color:var(--text-secondary)] text-[11px] font-semibold">Total Tickets</div>
              <div className="text-xl font-extrabold text-[color:var(--text-primary)]">{summary.total_tickets}</div>
            </div>
            <div className="rounded-xl border-l-4 border-blue-500 dark:border-blue-600 bg-[color:var(--surface)] p-3 shadow-sm border border-[color:var(--border)]">
              <div className="text-[color:var(--text-secondary)] text-[11px] font-semibold">Open Tickets</div>
              <div className="text-xl font-extrabold text-[color:var(--text-primary)]">{summary.open_tickets}</div>
            </div>
            <div className="rounded-xl border-l-4 border-green-500 dark:border-green-600 bg-[color:var(--surface)] p-3 shadow-sm border border-[color:var(--border)]">
              <div className="text-[color:var(--text-secondary)] text-[11px] font-semibold">Closed</div>
              <div className="text-xl font-extrabold text-[color:var(--text-primary)]">{summary.closed_tickets}</div>
            </div>
            <div className="rounded-xl border-l-4 border-orange-500 dark:border-orange-600 bg-[color:var(--surface)] p-3 shadow-sm border border-[color:var(--border)]">
              <div className="text-[color:var(--text-secondary)] text-[11px] font-semibold">Overdue</div>
              <div className="text-xl font-extrabold text-[color:var(--text-primary)]">{overdueCount}</div>
            </div>
          </div>

          {/* Composition Analysis */}
          <div className={`grid grid-cols-1 gap-2 ${roleName === 'management' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <SectionCard title="Status Distribution" headerColor="bg-blue-100" headerText="text-blue-900" borderColor="border-blue-500">
              {statusChartData.length > 0 ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                        <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={75} dataKey="value" paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 4 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm mt-4">No status data available.</p>
              )}
            </SectionCard>

            <SectionCard title="Priority Distribution" headerColor="bg-amber-100 dark:bg-amber-900/40" headerText="text-amber-900 dark:text-amber-300" borderColor="border-amber-500 dark:border-amber-700">
              {priorityChartData.length > 0 ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                        <Pie data={priorityChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                          {priorityChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 4 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm mt-4">No priority data available.</p>
              )}
            </SectionCard>

            {roleName === 'management' && (
              <SectionCard title="Department Breakdown" headerColor="bg-cyan-100 dark:bg-cyan-900/40" headerText="text-cyan-900 dark:text-cyan-300" borderColor="border-cyan-500 dark:border-cyan-700">
                {departmentChartData.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={departmentChartData} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fontWeight: 800, fill: 'var(--text-primary)' }} tickLine={false} axisLine={false} width={34} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fontWeight: 800, fill: 'var(--text-primary)' }} tickLine={false} axisLine={{ stroke: 'var(--text-secondary)' }} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
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

          {/* Trend Analysis */}
          <div className="grid grid-cols-1 gap-2 lg:min-h-[340px]">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-indigo-600 dark:border-indigo-800 bg-[color:var(--surface)] shadow-lg">
              <div className="flex w-full items-center justify-center gap-1.5 rounded-t-xl bg-indigo-100 dark:bg-indigo-900/40 px-2 py-1 text-center text-xs font-extrabold leading-snug text-indigo-900 dark:text-indigo-300 transition-colors sm:text-sm">
                <span className="text-xs">📈</span>
                <span className="whitespace-normal break-words">Monthly Ticket Volume — {formattedFiscalYear}</span>
              </div>
              <div className="flex-1 min-h-0 p-2 sm:p-3">
                {monthlyTrends.length > 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyTrends} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontWeight: 800, fill: 'var(--text-primary)' }} tickLine={false} axisLine={{ stroke: 'var(--text-secondary)' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 800, fill: 'var(--text-primary)' }} tickLine={false} axisLine={false} width={34} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                          <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 4 }} />
                          <Bar dataKey="Open" fill="url(#openGrad)" radius={[4, 4, 0, 0]} name="Open" />
                          <Bar dataKey="Closed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Closed" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm mt-4">No monthly trend data available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Performance Details */}
          <div className="grid grid-cols-1 items-stretch gap-2 lg:min-h-[280px] lg:grid-cols-2">
            <SectionCard title="Assignee Performance" subtitle="Assigned vs Overdue" headerColor="bg-emerald-100 dark:bg-emerald-900/40" headerText="text-emerald-900 dark:text-emerald-300" borderColor="border-emerald-500 dark:border-emerald-700">
              {assigneeBreakdownData.length > 0 ? (
                <div className="h-full min-h-0 overflow-hidden">
                  <div className="h-[260px] overflow-x-auto overflow-y-auto rounded-lg border-2 border-[color:var(--border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-emerald-50 dark:bg-emerald-900/30 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">S.No</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Assignee</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Assigned</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Overdue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border)]">
                        {assigneeBreakdownData.map((a, idx) => (
                          <tr key={a.name} className="hover:bg-[color:var(--surface-hover)] transition">
                            <td className="px-3 py-2 font-medium text-[color:var(--text-primary)] text-sm">{idx + 1}</td>
                            <td className="px-3 py-2 text-[color:var(--text-secondary)] text-sm">{a.name}</td>
                            <td className="px-3 py-2 text-[color:var(--text-secondary)] text-sm">{a.assigned_count || 0}</td>
                            <td className="px-3 py-2">
                              <span className="font-bold text-sm text-red-600 dark:text-red-400">{a.overdue_count || 0}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm mt-4">No assignee data available.</p>
              )}
            </SectionCard>

            <SectionCard title="Overdue Ticket Details" subtitle={`${(report?.overdue_table || []).length} overdue`} headerColor="bg-red-100 dark:bg-red-900/40" headerText="text-red-900 dark:text-red-300" borderColor="border-red-500 dark:border-red-700">
              {(report?.overdue_table || []).length > 0 ? (
                <div className="h-full min-h-0 overflow-hidden">
                  <div className="h-[260px] overflow-x-auto overflow-y-auto rounded-lg border-2 border-[color:var(--border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50 dark:bg-red-900/30 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">S.No</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Title</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Priority</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Department</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Due Date</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border)]">
                        {(report?.overdue_table || []).map((t, idx) => (
                          <tr key={t.id} className="hover:bg-[color:var(--surface-hover)] transition">
                            <td className="px-3 py-2 font-medium text-[color:var(--text-primary)] text-sm">{idx + 1}</td>
                            <td className="px-3 py-2 text-[color:var(--text-secondary)] text-sm max-w-[160px] truncate">{t.title || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${(String(t.priority || '').toLowerCase() === 'high' || String(t.priority || '').toLowerCase() === 'critical')
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                : String(t.priority || '').toLowerCase() === 'medium'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                }`}>
                                {t.priority || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[color:var(--text-secondary)] text-sm">{t.department || '—'}</td>
                            <td className="px-3 py-2 text-[color:var(--text-secondary)] text-sm">{formatDate(t.due_date)}</td>
                            <td className="px-3 py-2">
                              <span className={`font-bold text-sm ${t.overdue_days > 7 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
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
                  <p className="text-gray-400 text-sm">All tickets are within due dates or closed.</p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
