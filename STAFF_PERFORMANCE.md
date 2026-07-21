# Staff Performance

## Overview

The **Staff Performance** section in the Management Dashboard displays each active staff member's KMI performance for the selected fiscal year. Staff are grouped into three columns — **BEST**, **MEDIUM**, and **LOW** — based on their calculated achievement percentage.

Each staff card shows:
- Profile photo (with initials fallback)
- Full name
- Designation
- Color-coded performance badge

---

## Performance Calculation

Performance is derived from actual KMI data entries (`kpi_data_value`) using the same achievement formula used across the KMI module.

### Formula

| Metric Type | Formula | Examples |
|-------------|---------|----------|
| **Normal** (higher = better) | `(Actual / Target) × 100` | Sales, Revenue, Efficiency, Production |
- Result is clamped to a maximum of `100%`.
- If `target = 0` or either value is missing, that month's data point is skipped.

Note: the current dashboard implementation uses the target-based KPI calculation path only. It does not apply the earlier title-based inverse-metric heuristic.

### Per-KPI Average

For each target-based KPI assigned to an employee:

1. Gather all monthly `actual` and `target` values within the selected fiscal year (Apr – Mar).
2. Compute achievement for each month using the formula above.
3. Average the monthly achievements to get the KPI's overall score.

### Per-Staff Score

```
Staff Performance = Average of all target-based KPI scores assigned to that employee
```

If an employee has no target-based KPI data in the selected fiscal year, their score is `0`.

---

## Data Sources

### Frontend State

| State Variable | Source | Purpose |
|----------------|--------|---------|
| `allUsers` | `GET /users` | List of all staff with `empid`, `department_id`, `designation_name`, `staff_photo` |
| `cachedKpiValues` | `GET /kpi-values/kpi/:kpiId` (batched) | All KPI values for the selected fiscal year, including `data_operator` (empid) |
| `staffPerformanceData` | Computed by `loadStaffPerformance()` | Map of `userId → performance %` |
| `staffPerformanceLoading` | Boolean | Loading state while batch-fetching and calculating |

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/kpi-data-values/multiple` | POST | Batch fetch monthly actual/target data for multiple KPI value IDs and a given calendar year |

Two requests are sent per fiscal year:
- `year = selectedFiscalYear` (Apr – Dec of that year)
- `year = selectedFiscalYear + 1` (Jan – Mar of next year)

---

## Implementation

### Key Functions

#### `loadStaffPerformance()`
Located in `client/src/pages/management/ManagementDashboard.jsx`.

1. Groups `cachedKpiValues` by `data_operator` (empid).
2. Collects all unique `kpi_value_id`s across all employees.
3. Calls `/api/kpi-data-values/multiple` for both calendar years of the fiscal year in parallel.
4. Filters results to fiscal year months.
5. Skips KPI values that are not target-based.
6. For each employee's KPIs, calculates monthly achievement as `(actual / target) × 100` and clamps it to `100%`.
7. Averages monthly achievements to a KPI score, then averages KPI scores to produce the final staff performance percentage.
8. Stores result in `staffPerformanceData` state: `{ [userId]: number }`.

#### `staffList` (useMemo)
Derives the final staff list sorted by performance descending:

```js
const staffList = useMemo(() => {
  const activeUsers = allUsers.filter(u => u.status === 'active');
  return activeUsers
    .map(user => ({
      id: user.id,
      name: fullName,
      designation: user.designation_name || '',
      photo: user.staff_photo || '',
      performance: staffPerformanceData[user.id] || 0,
    }))
    .sort((a, b) => b.performance - a.performance || a.name.localeCompare(b.name));
}, [allUsers, staffPerformanceData]);
```

#### `StaffPerformanceList` Component
Renders three side-by-side columns on `md+` screens, stacked on mobile.

| Column | Threshold | Badge Color |
|--------|-----------|-------------|
| **BEST** | `performance >= 66` | Green |
| **MEDIUM** | `33 <= performance < 66` | Orange |
| **LOW** | `performance < 33` | Red |

---

## Dependencies

- `cachedKpiValues` must be populated first (loaded in `loadAllData()`).
- `allUsers` must be populated first (loaded in `fetchStatistics()`).
- `selectedFiscalYear` drives both the KPI filter and the fiscal month sequence.

The staff performance calculation triggers via `useEffect` when any of these dependencies change.

---

## Notes

- **No dummy data**: Staff performance is always calculated from real KMI entries. If no valid target-based data exists, the score is `0`.
- **Tickets excluded for now**: the current staff-performance implementation does not include tickets yet.
- **KMI consistency**: the dashboard uses the same target-vs-actual achievement rule as the KMI detail view.
