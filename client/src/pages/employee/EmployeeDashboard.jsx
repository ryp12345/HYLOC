import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyLeaveBalance } from '../../api/leaveApi';
import { getEmployeeKPIValues, getKPIValueMonthlyData, getKPIs } from '../../api/kpiApi';

// Monthly data for month M is due by this day of month M+1.
const DUE_DAY = 5;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACTION_ITEMS_LIMIT = 8;

const COLOR_SUCCESS = 'var(--success, #16a34a)';
const COLOR_WARNING = 'var(--warning)';
const COLOR_DANGER = 'var(--danger)';
const COLOR_NEUTRAL = 'var(--border)';

const getCurrentFiscalYearStart = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};

const formatFiscalYear = (startYear) => `${startYear}-${String(startYear + 1).slice(-2)}`;

const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// FY runs April(startYear) to March(startYear + 1).
const getFiscalMonths = (startYear) => [
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => ({ year: startYear, month })),
  ...[1, 2, 3].map((month) => ({ year: startYear + 1, month }))
];

const isInFiscalYear = (row, startYear) => {
  const rowFiscalYear = parseFiscalYear(row?.fin_year);
  // If API provides row-level fin_year, enforce direct FY match.
  if (rowFiscalYear != null) return rowFiscalYear === startYear;
  const monthNum = Number(row?.month);
  const yearNum = Number(row?.year);
  if (!Number.isFinite(monthNum) || !Number.isFinite(yearNum)) return false;
  if (yearNum === startYear && monthNum >= 4 && monthNum <= 12) return true;
  if (yearNum === startYear + 1 && monthNum >= 1 && monthNum <= 3) return true;
  return false;
};

const monthKey = (year, month) => `${Number(year)}-${Number(month)}`;
const formatMonth = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;
const formatDate = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// First instant after the month has ended (JS months are 0-based, so `month` is already the next month).
const getMonthEnd = (year, month) => new Date(year, month, 1);
const getDueDate = (year, month) => new Date(year, month, DUE_DAY, 23, 59, 59);

// When the actual value was entered; prefers actual-specific timestamps if the API sends them.
const getEntryTimestamp = (row) => {
  const raw = row?.actual_created_at ?? row?.actual_updated_at ?? row?.created_at ?? row?.createdAt ?? row?.updated_at ?? row?.updatedAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Defaults to "higher is better" unless the KPI value or KPI declares otherwise.
const isHigherBetter = (kpiValue, kpi) => {
  for (const source of [kpiValue, kpi]) {
    if (!source) continue;
    if (typeof source.higher_is_better === 'boolean') return source.higher_is_better;
    const direction = String(source.direction ?? source.polarity ?? source.target_direction ?? '').toLowerCase();
    if (/(lower|less|min|decreas|down)/.test(direction)) return false;
    if (/(higher|more|max|increas|up)/.test(direction)) return true;
  }
  return true;
};

const getCategoryName = (kpi) => String(kpi?.category_name ?? kpi?.category?.category_name ?? '').toUpperCase();

const isKai = (kpi) => {
  const name = getCategoryName(kpi);
  return name ? name.includes('KAI') : Number(kpi?.category_id) === 5;
};

const isKmi = (kpi) => {
  const name = getCategoryName(kpi);
  return name ? name.includes('KMI') : Number(kpi?.category_id) === 6;
};

// Walks up parent_kpi_id links to the KMI / global objective this KPI feeds into.
const findParentKmi = (kpi, kpiById) => {
  let current = kpi;
  for (let depth = 0; current && depth < 10; depth += 1) {
    if (isKmi(current)) return current;
    const parentId = current.parent_kpi_id;
    current = parentId != null ? kpiById.get(String(parentId)) : null;
  }
  return null;
};

const meetsTarget = (actual, target, higherBetter) => (higherBetter ? actual >= target : actual <= target);

const getPercentColor = (percent) => {
  if (percent == null) return COLOR_NEUTRAL;
  if (percent >= 80) return COLOR_SUCCESS;
  if (percent >= 50) return COLOR_WARNING;
  return COLOR_DANGER;
};

const getKmiStatus = ({ evaluated, met }) => {
  if (evaluated === 0) return { label: 'No results yet', color: COLOR_NEUTRAL };
  if (met === evaluated) return { label: 'On track', color: COLOR_SUCCESS };
  if (met === 0) return { label: 'Off track', color: COLOR_DANGER };
  return { label: 'Partly on track', color: COLOR_WARNING };
};

const EMPTY_STATS = {
  total: 0,
  kpiCount: 0,
  kaiCount: 0,
  achievement: { met: 0, evaluated: 0, percent: null },
  onTime: { onTime: 0, expected: 0, late: 0, percent: null },
  trend: { improved: 0, declined: 0, steady: 0 },
  actionItems: [],
  kmiContributions: []
};

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] border-l-4 bg-[color:var(--surface)] p-6 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div className="text-4xl">{icon}</div>
      <div className="min-w-0">
        <div className="mb-1 text-sm font-semibold text-[color:var(--text-secondary)]">{label}</div>
        <div className="text-3xl font-bold text-[color:var(--text-primary)]">{value}</div>
        {sub && <div className="mt-1 text-xs text-[color:var(--text-secondary)]">{sub}</div>}
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYearStart());
  const [kpiStats, setKpiStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    const fetchStats = async () => {
      // server expects employee identifier (empid) that matches "data operator"
      const empIdentifier = user?.empid || user?.id;
      if (!empIdentifier) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch leave balance
        const leaveRes = await getMyLeaveBalance(selectedFiscalYear);
        setLeaveBalance(leaveRes.data?.data || null);

        // Fetch assigned KPIs/KAIs - Use the employee-specific endpoint
        const [kpiEmpRes, kpisRes] = await Promise.all([
          getEmployeeKPIValues(empIdentifier),
          getKPIs().catch(() => ({ data: { data: [] } }))
        ]);

        const allKpis = Array.isArray(kpisRes.data?.data) ? kpisRes.data.data : [];
        const kpiById = new Map(allKpis.map((kpi) => [String(kpi.id), kpi]));
        const allAssignedKpis = Array.isArray(kpiEmpRes.data?.data) ? kpiEmpRes.data.data : [];
        const assignedKpis = allAssignedKpis.filter((kpiValue) => {
          const valueStartYear = parseFiscalYear(kpiValue?.fin_year);
          const parentKpi = kpiById.get(String(kpiValue?.kpi_id));
          const parentStartYear = parseFiscalYear(parentKpi?.fin_year);
          const startYear = valueStartYear ?? parentStartYear;
          // Strict FY filter to avoid showing previous-year assignments in newer FY.
          return startYear === selectedFiscalYear;
        });

        // Distinct KPI IDs assigned to this employee, split into KPIs and KAIs
        const assignedKpiIds = [...new Set(assignedKpis.map((k) => String(k.kpi_id)))];
        const kaiCount = assignedKpiIds.filter((id) => isKai(kpiById.get(id))).length;

        // Load monthly target/actual rows for every assigned KPI value in this FY
        const yearsToLoad = [selectedFiscalYear, selectedFiscalYear + 1];
        const monthlyResults = await Promise.allSettled(
          assignedKpis.map(async (kv) => {
            const yearRows = await Promise.all(
              yearsToLoad.map((year) =>
                getKPIValueMonthlyData(kv.id, year).then((r) => r.data?.data || []).catch(() => [])
              )
            );
            return yearRows.flat().filter((row) => isInFiscalYear(row, selectedFiscalYear));
          })
        );

        const now = new Date();
        const fiscalMonths = getFiscalMonths(selectedFiscalYear);
        const achievement = { met: 0, evaluated: 0 };
        const onTime = { onTime: 0, expected: 0, late: 0 };
        const trend = { improved: 0, declined: 0, steady: 0 };
        const actionItems = [];
        const kmiById = new Map();

        assignedKpis.forEach((kv, index) => {
          const result = monthlyResults[index];
          const rows = result.status === 'fulfilled' ? result.value : [];
          const rowByMonth = new Map(rows.map((row) => [monthKey(row.year, row.month), row]));
          const kpi = kpiById.get(String(kv.kpi_id));
          const higherBetter = isHigherBetter(kv, kpi);
          const valueLabel = kv.data || kv.name || kpi?.title || `KPI value #${kv.id}`;

          // On-time updates and pending entries: only months that have already ended count
          for (const { year, month } of fiscalMonths) {
            if (now < getMonthEnd(year, month)) continue;
            const dueDate = getDueDate(year, month);
            const row = rowByMonth.get(monthKey(year, month));
            if (toNumber(row?.actual_value) == null) {
              const overdue = now > dueDate;
              if (overdue) onTime.expected += 1;
              actionItems.push({ key: `${kv.id}-${year}-${month}`, valueLabel, kpiTitle: kpi?.title, year, month, dueDate, overdue });
              continue;
            }
            onTime.expected += 1;
            const enteredAt = getEntryTimestamp(row);
            // Without a timestamp we cannot tell it was late, so it counts as on time.
            if (!enteredAt || enteredAt <= dueDate) onTime.onTime += 1;
            else onTime.late += 1;
          }

          // Months with an actual value, latest first
          const actualMonths = rows
            .filter((row) => toNumber(row.actual_value) != null)
            .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month));

          // Target achievement: latest month that has both target and actual
          const latestWithTarget = actualMonths.find((row) => toNumber(row.target_value) != null);
          let isMet = null;
          if (latestWithTarget) {
            isMet = meetsTarget(toNumber(latestWithTarget.actual_value), toNumber(latestWithTarget.target_value), higherBetter);
            achievement.evaluated += 1;
            if (isMet) achievement.met += 1;
          }

          // Improvement: latest actual vs the previous actual
          if (actualMonths.length >= 2) {
            const latest = toNumber(actualMonths[0].actual_value);
            const previous = toNumber(actualMonths[1].actual_value);
            if (latest === previous) trend.steady += 1;
            else if ((latest > previous) === higherBetter) trend.improved += 1;
            else trend.declined += 1;
          }

          // Contribution to KMIs / global objectives
          const kmi = findParentKmi(kpi, kpiById);
          if (kmi) {
            const entry = kmiById.get(String(kmi.id)) || { id: kmi.id, title: kmi.title, contributing: 0, evaluated: 0, met: 0 };
            entry.contributing += 1;
            if (isMet != null) {
              entry.evaluated += 1;
              if (isMet) entry.met += 1;
            }
            kmiById.set(String(kmi.id), entry);
          }
        });

        // Overdue first, then oldest month first
        actionItems.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate - b.dueDate);

        const toPercent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

        setKpiStats({
          total: assignedKpiIds.length,
          kpiCount: assignedKpiIds.length - kaiCount,
          kaiCount,
          achievement: { ...achievement, percent: toPercent(achievement.met, achievement.evaluated) },
          onTime: { ...onTime, percent: toPercent(onTime.onTime, onTime.expected) },
          trend,
          actionItems,
          kmiContributions: [...kmiById.values()]
        });
      } catch (err) {
        console.error('Failed to fetch dashboard statistics', err);
        const msg = err?.response?.data?.message || err?.message || 'Failed to load statistics';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedFiscalYear, user?.empid, user?.id]);

  const fiscalYearOptions = Array.from({ length: 6 }, (_, index) => {
    const current = getCurrentFiscalYearStart();
    return current - index;
  });

  const { achievement, onTime, trend, actionItems, kmiContributions } = kpiStats;
  const overdueCount = actionItems.filter((item) => item.overdue).length;
  const dueSoonCount = actionItems.length - overdueCount;
  const trendTotal = trend.improved + trend.declined + trend.steady;

  return (
    <>
      <div className="space-y-6 text-[color:var(--text-primary)]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-[color:var(--text-primary)]">Employee Dashboard</h1>
              <p className="text-[color:var(--text-secondary)]">Welcome, {user?.firstName} {user?.lastName}</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--accent)]">Showing statistics for FY {formatFiscalYear(selectedFiscalYear)}</p>
            </div>
            <div className="min-w-[180px]">
              <label htmlFor="dashboard-fiscal-year" className="mb-1 block text-sm font-semibold text-[color:var(--text-secondary)]">
                Financial Year
              </label>
              <select
                id="dashboard-fiscal-year"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent)]"
              >
                {fiscalYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {formatFiscalYear(year)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPI/KAIs Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="📊"
            label="My KPIs/KAIs"
            value={loading ? '—' : kpiStats.total}
            sub={loading ? null : `${kpiStats.kpiCount} KPI · ${kpiStats.kaiCount} KAI`}
            color="var(--accent)"
          />
          <StatCard
            icon="🎯"
            label="Target Achievement"
            value={loading || achievement.percent == null ? '—' : `${achievement.percent}%`}
            sub={
              loading
                ? null
                : achievement.evaluated > 0
                  ? `${achievement.met} of ${achievement.evaluated} values on target (latest month)`
                  : 'No results entered yet'
            }
            color={loading ? COLOR_NEUTRAL : getPercentColor(achievement.percent)}
          />
          <StatCard
            icon="⏱️"
            label="On-time Updates"
            value={loading || onTime.percent == null ? '—' : `${onTime.percent}%`}
            sub={
              loading
                ? null
                : onTime.expected > 0
                  ? `${onTime.onTime} of ${onTime.expected} monthly entries by the ${DUE_DAY}th${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
                  : 'No entries due yet'
            }
            color={loading ? COLOR_NEUTRAL : getPercentColor(onTime.percent)}
          />
          <StatCard
            icon="📈"
            label="Improving"
            value={loading || trendTotal === 0 ? '—' : `${trend.improved} / ${trendTotal}`}
            sub={
              loading
                ? null
                : trendTotal > 0
                  ? `${trend.improved} improved · ${trend.declined} declined · ${trend.steady} steady vs previous entry`
                  : 'Needs at least two months of results'
            }
            color={loading || trendTotal === 0 ? COLOR_NEUTRAL : trend.improved >= trend.declined ? COLOR_SUCCESS : COLOR_WARNING}
          />
        </div>

        {error && (
          <div className="rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">
            {error}
          </div>
        )}

        {/* Action Needed */}
        {!loading && (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-[color:var(--text-primary)]">Action Needed</h2>
              {actionItems.length > 0 && (
                <span className="text-sm text-[color:var(--text-secondary)]">
                  {overdueCount} overdue{dueSoonCount > 0 ? ` · ${dueSoonCount} due soon` : ''}
                </span>
              )}
            </div>
            {actionItems.length === 0 ? (
              <p className="text-sm text-[color:var(--text-secondary)]">✅ All your monthly data is up to date.</p>
            ) : (
              <>
                <ul className="divide-y divide-[color:var(--border)]">
                  {actionItems.slice(0, ACTION_ITEMS_LIMIT).map((item) => (
                    <li key={item.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-[color:var(--text-primary)]">{item.valueLabel}</div>
                        <div className="text-sm text-[color:var(--text-secondary)]">
                          {item.kpiTitle && item.kpiTitle !== item.valueLabel ? `${item.kpiTitle} · ` : ''}
                          {formatMonth(item.year, item.month)} actual not entered
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: item.overdue ? COLOR_DANGER : COLOR_WARNING }}>
                          {item.overdue ? `Overdue since ${formatDate(item.dueDate)}` : `Due by ${formatDate(item.dueDate)}`}
                        </span>
                        <a
                          href="/employee/kpikai"
                          className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
                        >
                          Update
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
                {actionItems.length > ACTION_ITEMS_LIMIT && (
                  <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
                    + {actionItems.length - ACTION_ITEMS_LIMIT} more pending entries
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Contribution to KMIs */}
        {!loading && kmiContributions.length > 0 && (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-bold text-[color:var(--text-primary)]">My Contribution to KMIs</h2>
            <p className="mb-4 text-sm text-[color:var(--text-secondary)]">Global objectives your KPIs/KAIs feed into, based on your latest results.</p>
            <ul className="divide-y divide-[color:var(--border)]">
              {kmiContributions.map((kmi) => {
                const status = getKmiStatus(kmi);
                return (
                  <li key={kmi.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-[color:var(--text-primary)]">{kmi.title}</div>
                      <div className="text-sm text-[color:var(--text-secondary)]">
                        {kmi.contributing} of your values contribute
                        {kmi.evaluated > 0 ? ` · ${kmi.met} of ${kmi.evaluated} on target` : ''}
                      </div>
                    </div>
                    <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a href="/employee/kpikai" className="block rounded-lg bg-[color:var(--accent)] p-4 text-center text-white transition hover:bg-[color:var(--accent-hover)]">
              <div className="font-semibold">View My KPIs/KAIs</div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default EmployeeDashboard;
