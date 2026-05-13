# KPI Formula User Manual

This guide explains all formula types and syntax supported by the current system.

## 1. Formula Types

### 1. Manual KPI Value
- `kpi_type = manual`
- No formula required.
- Users enter target/actual directly.

### 2. Computed Actual (Option 2)
- `kpi_type = computed`
- Uses `formula` to calculate `actual` value.
- Typical use: user enters target, system computes actual.

### 3. Computed Target (Option 3)
- `kpi_type = computed`
- Uses `target_formula` to calculate `target` value.
- Typical use: user enters actual, system computes target.

### 4. Computed with Both Formulas
- `kpi_type = computed`
- Can have both `formula` and `target_formula`.
- Each formula is evaluated for its respective value type.

## 2. KPI Reference Syntax

Formula variables reference KPI Value IDs.

- `v123` -> default reference to KPI Value ID 123
- `v123:actual` -> explicitly use actual value of KPI Value 123
- `v123:target` -> explicitly use target value of KPI Value 123

Notes:
- Variable format must start with `v` followed by digits.
- References are month/year specific during calculation.

## 3. Supported Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Parentheses: `(`, `)`
- Comparisons: `>`, `<`, `>=`, `<=`, `=`, `!=`
- Logical tokens allowed by validator: `&`, `|`

Note on equality:
- In formula text, `=` is converted internally for comparison checks in expressions.

## 4. Supported Functions

### 4.1 `SUM`
- Syntax: `SUM(a, b, c, ...)`
- Example: `SUM(v101, v102, v103)`

### 4.2 `AVERAGE`
- Syntax: `AVERAGE(a, b, c, ...)`
- Example: `AVERAGE(v101:actual, v102:actual, v103:actual)`

### 4.3 `MIN`
- Syntax: `MIN(a, b, c, ...)`
- Example: `MIN(v201, v202, v203)`

### 4.4 `MAX`
- Syntax: `MAX(a, b, c, ...)`
- Example: `MAX(v201, v202, v203)`

### 4.5 `ABS`
- Syntax: `ABS(value)`
- Example: `ABS(v301 - v302)`

### 4.6 `ROUND`
- Syntax with decimals: `ROUND(value, decimals)`
- Syntax without decimals: `ROUND(value)`
- Examples:
  - `ROUND(v401 / v402, 2)`
  - `ROUND(v401)`

### 4.7 `IF`
- Syntax: `IF(condition, trueValue, falseValue)`
- Example: `IF(v501:actual >= v501:target, 100, 0)`

### 4.8 `CUMSUM`
- Syntax: `CUMSUM(v123)`
- Computes cumulative sum from fiscal-year start (April) up to current month.
- Works for the active calculation value type (actual or target).
- Example: `CUMSUM(v701) / v702 * 100`

## 5. Validation Rules

A formula is considered valid when:
- Parentheses are balanced.
- It contains allowed characters/tokens.
- At least one KPI variable reference (`v<id>`) exists.

## 6. How Calculation Runs

During monthly save:
- If `target_formula` exists and target is empty, system attempts to compute target.
- If `formula` exists for computed KPI and actual is empty (with qualifying input), system attempts to compute actual.
- Dependent computed KPIs can be recalculated after source updates.

## 7. Missing Dependency Behavior

- If required dependency values are missing for the month/year, computation is skipped and not stored.
- Typical reason: referenced KPI value has no actual/target entry for that period.

## 8. Formula Examples

### Example A: Achievement %
`(v1001:actual / v1001:target) * 100`

### Example B: Weighted score
`ROUND((v2001 * 0.4) + (v2002 * 0.6), 2)`

### Example C: Threshold check
`IF(v3001 >= 95, 1, 0)`

### Example D: Cumulative progress
`ROUND((CUMSUM(v4001) / v4002:target) * 100, 1)`

## 9. Best Practices

- Prefer explicit suffixes (`:actual`, `:target`) in mixed formulas.
- Keep formulas simple and test incrementally.
- Ensure all dependency KPI values have monthly entries.
- Use `ROUND` for user-facing percentage/ratio outputs.
- For cumulative metrics, use `CUMSUM(vID)` instead of manual month chains.

## 10. Quick Troubleshooting

If formula is not calculating:
1. Verify formula has valid `v<ID>` references.
2. Check source KPI values exist for same month/year.
3. Confirm correct formula field is used:
   - `formula` for computed actual
   - `target_formula` for computed target
4. Check syntax: commas, parentheses, function names.
5. Test with a smaller formula first (for example, `v101 + v102`).
