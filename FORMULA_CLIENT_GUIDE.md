# KPI Formula Guide for Clients

This document explains all formula formats supported in the KPI system, with examples you can use directly.

## 1) Formula Types Used in the System

1. Manual KPI
- No formula is required.
- User enters target and/or actual values directly.

2. Computed Actual
- Uses formula field: formula
- System calculates actual value from dependencies.

3. Computed Target
- Uses formula field: target_formula
- System calculates target value from dependencies.

4. Mixed Computed KPI
- Can use both formula and target_formula.
- Actual and target can be calculated separately.

## 2) Variable Reference Format

Use KPI Value IDs with the following syntax:

- v123
  - Uses KPI Value ID 123 (default value type based on context).

- v123:actual
  - Explicitly uses actual value of KPI Value 123.

- v123:target
  - Explicitly uses target value of KPI Value 123.

## 3) Supported Operators

Arithmetic:
- +  Add
- -  Subtract
- *  Multiply
- /  Divide
- %  Modulo

Comparisons (for IF conditions):
- >, <, >=, <=, =, !=

Grouping:
- ( ) parentheses

## 4) Supported Functions with Examples

### A) SUM
Adds all inputs.

Syntax:
- SUM(a, b, c)

Examples:
- SUM(v101, v102, v103)
- SUM(v201:actual, v202:actual)

### B) AVERAGE
Returns arithmetic mean.

Syntax:
- AVERAGE(a, b, c)

Examples:
- AVERAGE(v101, v102, v103)
- AVERAGE(v401:actual, v402:actual, v403:actual)

### C) MIN
Returns smallest value.

Syntax:
- MIN(a, b, c)

Example:
- MIN(v501, v502, v503)

### D) MAX
Returns largest value.

Syntax:
- MAX(a, b, c)

Example:
- MAX(v501, v502, v503)

### E) ABS
Returns absolute value.

Syntax:
- ABS(a)

Example:
- ABS(v601 - v602)

### F) ROUND
Rounds numbers.

Syntax:
- ROUND(value)
- ROUND(value, decimals)

Examples:
- ROUND(v701)
- ROUND(v701 / v702, 2)

### G) IF
Conditional formula.

Syntax:
- IF(condition, true_value, false_value)

Examples:
- IF(v801:actual >= v801:target, 100, 0)
- IF(v901 > 0, v902 / v901, 0)

### H) CUMSUM
Cumulative sum from fiscal year start (April) to current month.

Syntax:
- CUMSUM(v123)

Examples:
- CUMSUM(v1001)
- ROUND((CUMSUM(v1001) / v1002:target) * 100, 1)

## 5) Ready-to-Use Business Examples

1. Achievement Percentage
- (v1101:actual / v1101:target) * 100

2. Weighted KPI Score
- ROUND((v1201 * 0.4) + (v1202 * 0.6), 2)

3. Pass or Fail Check
- IF(v1301 >= 95, 1, 0)

4. Cumulative Progress Against Target
- ROUND((CUMSUM(v1401) / v1402:target) * 100, 1)

5. Cost Variance
- v1501:actual - v1501:target

6. Safe Division (avoid divide-by-zero)
- IF(v1602 = 0, 0, v1601 / v1602)

## 6) Rules to Follow

1. Use only valid KPI references (v<ID> format).
2. Keep parentheses balanced.
3. Use commas correctly in functions.
4. Ensure dependent KPI values exist for the same month/year.
5. Prefer explicit references (v123:actual or v123:target) in mixed formulas.

## 7) Common Errors and Fixes

1. Error: Missing dependencies
- Cause: Source KPI values are not entered for that month/year.
- Fix: Enter source KPI values first, then recalculate.

2. Error: Invalid formula syntax
- Cause: Missing bracket/comma or invalid token.
- Fix: Re-check brackets, commas, and function names.

3. Wrong result due to value type
- Cause: Formula used v123 (default) where explicit actual/target was needed.
- Fix: Use v123:actual or v123:target.

## 8) Quick Client Checklist Before Go-Live

1. Validate all formulas with sample data.
2. Confirm all dependency KPI values are mapped and available.
3. Review IF conditions for threshold KPIs.
4. Confirm rounding rules for percentages and ratios.
5. Test one full fiscal cycle case for CUMSUM-based KPIs.

---

Prepared for client sharing.
