# 🏗️ Plant Efficiency - Multi-Level Hierarchical Navigation Guide

## Overview
The Plant Efficiency page now features a fully functional **multi-level hierarchical navigation system** that allows users to drill down through unlimited levels of KPI hierarchy, starting from the root "Plant Efficiency" and navigating through child KPIs like OEE → Availability → TPM Tracker → Setting Time, and beyond.

---

## 📊 Key Features

### 1. **Dynamic Hierarchy Navigation**
- **Auto-Discovery**: Automatically loads all KPIs from the database
- **Parent-Child Relationships**: Uses the `parent_id` field in the KPIs table to establish hierarchy
- **Unlimited Levels**: Navigate through as many hierarchy levels as your KPI structure contains
- **Dynamic Loading**: Fetches child KPIs on-demand when you drill down

### 2. **Multi-Level Hierarchy Path**
Example of the hierarchical structure you can navigate:

```
Level 1: Plant Efficiency (Root)
  ↓
Level 2: Overall Equipment Effectiveness (OEE)
  ↓
Level 3: Availability Efficiency (AE)
  ↓
Level 4: TPM Tracker - Setting Time
  ↓
Level 5+: Continue drilling for more granular metrics
```

### 3. **Visual Navigation Indicators**
- **Level Badges**: Each level displays "Level N" showing your current depth
- **Breadcrumb Trail**: Visual path showing all levels you've navigated through
- **DRILL DOWN Indicators**: Cards with children show a "▶ DRILL DOWN" button
- **Current Level Analysis**: Shows parent KPI details and relationship to children

### 4. **Data Visualization at Each Level**
Every KPI card displays:
- **Current Value**: Actual metric value for the current month
- **Target Value**: Expected or target metric value
- **Achievement %**: Calculated as (Current / Target) × 100
- **Color Coding**: 
  - 🟢 Green: ≥80% achievement
  - 🟡 Yellow: 60-79% achievement
  - 🔴 Red: <60% achievement
- **Mini Trend Chart**: 12-month fiscal year data visualization
- **Full Chart Modal**: Click to expand and see detailed monthly data with actual vs target lines

---

## 🎯 How to Use

### Navigation Flow
1. **Start at Root**: Page loads with the root "Plant Efficiency" KPI
2. **View Sub-KPIs**: All child KPIs are displayed below
3. **Drill Down**: Click any card with "▶ DRILL DOWN" to navigate one level deeper
4. **Repeat**: Continue drilling through all hierarchy levels
5. **Go Back**: Use breadcrumb trail to jump to any previous level instantly

### Understanding the Layout

#### Header Section
```
⚡ Plant Efficiency - Hierarchical Navigation
    Level 2 (shown when navigated)

Description of what you're viewing
```

#### Breadcrumb Navigation
Shows your navigation path with clickable buttons:
```
HIERARCHY PATH: Level 1: Plant Efficiency ▶ Level 2: OEE ▶ Level 3: Availability
```
- Click any level to jump back instantly
- Current level is highlighted in blue with scale effect

#### Current Level KPI Display
Shows the parent KPI you're currently viewing:
- Title and description
- Current and target values
- Achievement percentage
- Parent-Child relationship info

#### Sub-KPIs Grid
Displays all direct children of the current KPI:
- Drillable cards show "▶ DRILL DOWN"
- Non-drillable cards (leaf nodes) have no drill down option
- Color-coded based on achievement
- Click mini chart to expand into full view

---

## 📈 Data Analysis at Each Level

### Level 1: Plant Efficiency (Root)
- Overall plant performance indicator
- Shows aggregate of all contributing factors
- Click to drill into OEE and other main KPI areas

### Level 2: OEE (Overall Equipment Effectiveness)
- Major performance metric
- Children include availability, performance, quality factors
- Navigate further to see specific efficiency metrics

### Level 3: Availability Efficiency
- Equipment uptime and availability data
- View long-term trends and monthly performance
- Drill into root cause tracking (TPM, maintenance metrics)

### Level 4: TPM Tracker
- Preventive maintenance tracking
- Drill into specific maintenance activities
- View setting times, changeover data, downtime causes

### Level 5+: Granular Metrics
- Setting Time CNC
- Changeover duration
- Specific maintenance activities
- Continue exploring your full KPI hierarchy

---

## 🔍 Key Navigation Functions

### Drilling Down
```javascript
// Click card with "▶ DRILL DOWN"
// → Loads children of that KPI
// → Adds to breadcrumb trail
// → Shows "Level N" indicator
```

### Jumping via Breadcrumb
```javascript
// Click any level in breadcrumb
// → Instantly navigates to that level
// → Removes deeper levels
// → Resets view to that level's children
```

### Viewing Charts
```javascript
// Click mini chart on any KPI card
// → Opens full-screen expanded chart modal
// → Shows 12-month fiscal year data
// → Displays actual vs target lines
// → Shows detailed monthly breakdowns
```

---

## 💡 Tips for Effective Analysis

### 1. **Identify Performance Issues**
- Use color coding to spot low performers (red cards)
- Drill into low-scoring KPIs to analyze root causes
- Track performance trends using the expanded charts

### 2. **Track Parent-Child Relationships**
- Understand how child KPIs contribute to parent performance
- See if reducing a parent's target requires improvement across multiple children
- Identify which child KPIs have the biggest impact

### 3. **Explore Different Paths**
- Navigate through different branches of the hierarchy
- Compare performance across similar metrics at the same level
- Use breadcrumb to quickly switch between levels

### 4. **Use Fiscal Year Data**
- Charts show April 2025 - March 2026 fiscal year
- Monthly data shows actual vs target values
- Identify seasonal patterns and trends
- Track performance improvement over time

### 5. **Leverage Level Indicators**
- Know your current depth with "Level N" badges
- Plan deeper dives when you see promising metrics
- Navigate back up when you've found key insights

---

## 🛠️ Technical Details

### Database Structure
The hierarchy is built using the KPIs table with:
- `id`: Unique KPI identifier
- `parent_id`: Reference to parent KPI (NULL for root)
- `title`: KPI name
- `description`: Detailed description
- `unit`: Measurement unit (%, hours, etc.)

### API Endpoints Used
1. **GET /kpis** - Fetch all KPIs
2. **GET /kpi-values/kpi/:id** - Get KPI value record
3. **GET /kpi-values/:id/monthly-data/:year** - Fetch monthly data

### Fiscal Year Schedule
- Start: April 2025
- End: March 2026
- Months: 1 = April, 12 = March (next year)

---

## 🚀 Advanced Features

### Dynamic KPI Discovery
The system automatically:
- Detects root KPI (no parent_id)
- Finds all children using parent_id matching
- Builds unlimited hierarchy depth
- Works with any KPI structure

### Performance Optimization
- Lazy loads child KPIs only when needed
- Caches all KPIs in state to minimize API calls
- Efficiently handles multiple levels navigation

### Error Handling
- Gracefully handles missing data
- Shows empty state for KPIs without children
- Continues loading even if some months have no data
- Provides meaningful error messages

---

## 📱 UI Components

### MiniLineChart
Small 200×80 SVG chart on KPI cards showing:
- 12-month trend line
- Color-matched to card performance
- Clickable to expand

### FullKPIChart
Expanded modal showing:
- 900×400 SVG chart
- Actual vs target lines
- Grid and axis labels
- Month labels
- Legend
- Close button (×)

### KPI Cards
Responsive grid cards with:
- Title and description
- Current/target values
- Achievement percentage
- Progress bar
- Mini chart
- Drill down indicator (if has children)

---

## ✅ Validation Checklist

Before deploying, verify:
- [ ] KPI hierarchy is properly configured in database
- [ ] All KPIs have correct parent_id values
- [ ] Root KPI(s) have parent_id = NULL
- [ ] Monthly data exists for target fiscal year
- [ ] KPI values have associated monthly records
- [ ] API endpoints return expected data format
- [ ] Navigation works through all hierarchy levels
- [ ] Charts display correctly at each level
- [ ] Breadcrumb allows jumping to previous levels
- [ ] Color coding reflects achievement thresholds

---

## 🎓 Example Use Cases

### Use Case 1: Root Cause Analysis
1. View Plant Efficiency (Level 1)
2. Drill into underperforming child KPI (Level 2)
3. Continue drilling to find specific issue (Level 3+)
4. Use expanded charts to identify trends
5. Navigate back up to see impact on parent

### Use Case 2: Trend Analysis
1. Navigate to specific KPI level
2. Click mini chart to expand
3. Analyze 12-month trend
4. Compare actual vs target
5. Identify seasonal patterns

### Use Case 3: Performance Comparison
1. View all sub-KPIs at same level
2. Compare color coding and values
3. Identify outliers
4. Drill into issues for analysis
5. Track performance improvements

### Use Case 4: Strategic Planning
1. Navigate full hierarchy
2. Identify bottlenecks at each level
3. Plan interventions
4. Track improvements over time
5. Adjust targets based on trending data

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Status**: Production Ready ✅
