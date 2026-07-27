# Staff Performance

## Overview

The **Staff Performance** section in the Management Dashboard displays each active staff member's KPI performance for the selected fiscal year. Staff are grouped into three columns — **BEST**, **MEDIUM**, and **LOW** — based on their calculated performance percentage.

Each staff card shows:
- Profile photo (with initials fallback)
- Full name
- Designation
- Color-coded performance badge

---

## Performance Calculation

Performance is derived from KPI data values for the selected fiscal year.

### Formula

| Metric Type | Formula | Examples |
|-------------|---------|----------|
| **Normal** (higher = better) | `(Actual / Target) × 100` | Sales, Revenue, Efficiency, Production |

- Result is clamped to a maximum of `100%`.
- If `target = 0` or either value is missing, that month's data point is skipped.
- KPIs with `target_required = false` are excluded from the staff performance score.

### Per-KPI Average

For each KPI value assigned to an employee:

1. Gather the KPI value records linked to that employee's `empid`.
2. Fetch monthly actual/target rows for the selected fiscal year using both calendar years in the fiscal range.
3. Keep only rows that fall inside the fiscal year month sequence.
4. Compute achievement for each month using the formula above.
5. Average the monthly achievements to get the KPI's overall score.

### Per-Staff Score

```
Staff Performance = Average of all KPI scores assigned to that employee
```

If an employee has no valid KPI data in the selected fiscal year, their score is `0`.

---

## Data Sources

### Frontend State

| State Variable | Source | Purpose |
|----------------|--------|---------|
| `allUsers` | `getUsers()` | List of all staff, including `id`, `empid`, `designation_name`, and `staff_photo` |
| `cachedKpiValues` | `getKpiValuesForFiscalYear()` | KPI values for the selected fiscal year, including `data_operator` |
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

1. Builds a lookup from each user's `empid` to their `user.id`.
2. Groups `cachedKpiValues` by `data_operator` so each employee gets their own KPI values.
3. Collects all unique `kpi_value_id`s across those KPI values.
4. Calls `/api/kpi-data-values/multiple` for both calendar years of the fiscal year in parallel.
5. Filters returned rows to the fiscal year month sequence.
6. Skips KPI values where `target_required` is `false`.
7. For each month, calculates achievement as `(actual / target) × 100`, clamps it to `100%`, and ignores months with missing data or `target = 0`.
8. Averages monthly achievements to a KPI score, then averages KPI scores to produce the final staff performance percentage.
9. Stores the result in `staffPerformanceData` state as `{ [userId]: number }`.

#### `staffList` (useMemo)
Derives the final staff list sorted by performance descending:

```js
const staffList = useMemo(() => {
  const activeUsers = allUsers.filter(u => (u.status || '').toLowerCase() === 'active');
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

- The dashboard shows only active users.
- If no valid KPI values exist for an employee in the selected fiscal year, the score is `0`.
