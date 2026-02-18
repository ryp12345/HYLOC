# Fiscal Year Data Fetching Flow

## Dashboard Fiscal Year Selection

### 1. State Management
- **State**: `selectedFiscalYear` (initialized to current fiscal year)
- **Selector UI**: Located in dashboard header (line 1560)
- **Available Years**: Extracted from KPI fin_year field, stored in `availableFiscalYears`

### 2. Fiscal Month Sequence Computation
- **Formula**: `getFiscalMonthSequence(selectedFiscalYear)`
- **Computed As**: Memoized based on selectedFiscalYear changes
- **Output**: Array of 12 months with format: `{ month, year, label }`
  - April-December: use `selectedFiscalYear`
  - January-March: use `selectedFiscalYear + 1`

### 3. Chart Data Loading Flow

All chart loading functions receive:
1. `fiscalValues` parameter (KPI values filtered by selectedFiscalYear)
2. Access to `FISCAL_MONTH_SEQUENCE` (computed from selectedFiscalYear)

#### Example: loadSalesChart
```
1. Get fiscal year: selectedFiscalYear (e.g., 2025)
2. Create FISCAL_MONTH_SEQUENCE from 2025
3. For each month in sequence:
   - Get month and year from FISCAL_MONTH_SEQUENCE
   - Call API: /kpi-data-values/{kpiValueId}/monthly?year={year}
   - Filter results by month and year
4. Return combined data for all fiscal months
```

### 4. API Calls

**Endpoint**: `/kpi-data-values/{kpiValueId}/monthly?year={year}`

**Parameters**:
- `kpiValueId`: The KPI value ID
- `year`: Calendar year (from FISCAL_MONTH_SEQUENCE)

**Returns**: All data for that KPI value in the given calendar year

### 5. Data Concatenation

Charts concatenate data from both calendar years:
- Year 1 (e.g., 2025): April, May, June, July, August, September, October, November, December
- Year 2 (e.g., 2026): January, February, March

This combines to form the complete fiscal year (Apr 2025 - Mar 2026)

## Issues to Verify

1. ✅ FISCAL_MONTH_SEQUENCE properly generated for selectedFiscalYear
2. ✅ Chart functions use FISCAL_MONTH_SEQUENCE correctly  
3. ✅ API calls include both calendar years
4. ✅ Frontend filters results by month and year from FISCAL_MONTH_SEQUENCE
5. ✅ Charts display data in fiscal month order (Apr-Mar)

## Testing Steps

1. Select a specific fiscal year from the dashboard selector
2. Check browser console for:
   - `📊 Loading Sales Chart for Fiscal Year: XXXX`
   - `📅 Fetching Sales data for month X, year YYYY`
3. Verify that:
   - Only months from that fiscal year appear in charts
   - Both calendar years are included if fiscal year spans two years
   - Data matches the selected fiscal year

## Related Files

- Frontend: `/client/src/pages/management/ManagementDashboard.jsx`
- Backend: `/server/src/controllers/kpi-data-value.controller.js`
- Model: `/server/src/models/kpi-data-value.model.js`
