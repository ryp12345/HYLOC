const pool = require('../config/db');
const FormulaEvaluator = require('../utils/formulaEvaluator');

const UPSERT_DATA_VALUE_SQL = `
  INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (kpi_value_id, month, year, value_type)
  DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  RETURNING *`;

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const isValidNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Months of the fiscal year (April → March) that come after the given month.
 * @returns {{month: number, year: number}[]}
 */
const getLaterFiscalMonths = (month, year) => {
  const months = [];
  let m = month;
  let y = year;
  while (m !== 3) {
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    months.push({ month: m, year: y });
  }
  return months;
};

/** Safely list the references in a formula (empty list when the formula does not parse). */
const safeReferences = (formula) => {
  if (!formula) return [];
  try {
    return FormulaEvaluator.extractReferences(formula);
  } catch (error) {
    return [];
  }
};

class KPICalculationService {
  /**
   * Compute cumulative sum for a base KPI value from April to the given month within fiscal year.
   * Fiscal year: Apr (4) .. Dec (12) of previous calendar year + Jan (1) .. Mar (3) of current calendar year.
   * Always read from the database so corrections to earlier months are reflected immediately.
   * @param {number} sourceKpiValueId
   * @param {number} month - calendar month (1-12)
   * @param {number} year - calendar year of the target month
   * @returns {Promise<number>}
   */
  static async computeCumulativeSumForSource(sourceKpiValueId, month, year, valueType = 'actual') {
    // First, get the unit_symbol for this KPI value
    const kpiValueResult = await pool.query(
      `SELECT k.data, u.symbol as unit_symbol
       FROM kpi_values k
       LEFT JOIN unit_master u ON k.uom = u.id
       WHERE k.id = $1`,
      [sourceKpiValueId]
    );

    const kpiData = kpiValueResult.rows?.[0];
    const unitSymbol = kpiData?.unit_symbol;
    const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));

    // Build query conditions for fiscal range (April to current month)
    let query;
    let params;

    if (month >= 4) {
      // Target month is April-December: sum April..month of same calendar year
      query = `SELECT COALESCE(SUM(value::numeric), 0) AS total
               FROM kpi_data_value
               WHERE kpi_value_id = $1
                 AND value_type = $2
                 AND year = $3
                 AND month >= 4
                 AND month <= $4`;
      params = [sourceKpiValueId, valueType, year, month];
    } else {
      // Target month is Jan-March: sum April..Dec of prev year + Jan..month of current year
      query = `SELECT COALESCE(SUM(value::numeric), 0) AS total
               FROM kpi_data_value
               WHERE kpi_value_id = $1
                 AND value_type = $2
                 AND (
                   (year = $3 AND month >= 4)
                   OR (year = $4 AND month >= 1 AND month <= $5)
                 )`;
      params = [sourceKpiValueId, valueType, year - 1, year, month];
    }

    const result = await pool.query(query, params);
    let num = parseFloat(result.rows?.[0]?.total);

    if (Number.isNaN(num)) return 0;

    // If unit is percentage, convert to a fraction (95% -> 0.95)
    if (isPercentage) {
      num = num / 100;
    }

    // Remove floating-point noise only. The computed KPI's own result is rounded
    // by its unit in calculateKPIValue, so no precision is lost here.
    return Math.round(num * 1e6) / 1e6;
  }

  /**
   * Fetch the latest stored value for each (kpi_value_id, value_type) pair for a month.
   * @returns {Promise<Map<string, number>>} keyed by `${id}:${valueType}`
   */
  static async fetchMonthValues(ids, month, year) {
    if (ids.length === 0) return new Map();

    const result = await pool.query(
      `SELECT DISTINCT ON (kpi_value_id, value_type) kpi_value_id, value_type, value
       FROM kpi_data_value
       WHERE kpi_value_id = ANY($1::bigint[]) AND month = $2 AND year = $3
       ORDER BY kpi_value_id, value_type, created_at DESC`,
      [ids, month, year]
    );

    const values = new Map();
    for (const row of result.rows) {
      const value = parseFloat(row.value);
      if (!Number.isNaN(value)) {
        values.set(`${row.kpi_value_id}:${row.value_type}`, value);
      }
    }
    return values;
  }

  /**
   * Calculate a computed KPI value for a specific month/year
   * @param {number} kpiValueId - The computed KPI value ID
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {number} empId - Employee ID
   * @returns {Promise<number>} - Calculated value
   */
  static async calculateKPIValue(kpiValueId, month, year, empId, valueType = 'actual') {
    try {
      // Get the KPI value with its formula and dependencies
      const kpiValueResult = await pool.query(
        `SELECT id, formula, source_kpi_value_ids,
                target_formula, target_source_kpi_value_ids,
                kpi_type, data, target_required
         FROM kpi_values
         WHERE id = $1`,
        [kpiValueId]
      );

      const kpiValue = kpiValueResult.rows[0];

      if (!kpiValue) {
        throw new Error(`KPI Value ${kpiValueId} not found`);
      }

      if ((kpiValue.kpi_type || '').toLowerCase() !== 'computed') {
        throw new Error(`KPI Value ${kpiValueId} is not a computed type`);
      }

      // Use the target-specific formula for targets; otherwise the actual formula
      // (which, for targets, is applied to the source targets).
      const formulaToUse = valueType === 'target' && kpiValue.target_formula
        ? kpiValue.target_formula
        : kpiValue.formula;

      if (!formulaToUse) {
        throw new Error(`KPI Value ${kpiValueId} has no formula defined for ${valueType}`);
      }

      // Work out exactly which values the formula needs:
      //  v123          -> value of the type being calculated (actual or target)
      //  v123:actual   -> actual value
      //  v123:target   -> target value
      //  CUMSUM(v123)  -> cumulative total, which also requires this month's value to exist
      const references = FormulaEvaluator.extractReferences(formulaToUse);

      if (references.length === 0) {
        throw new Error(`No source KPI values defined for ${kpiValue.data} ${valueType}`);
      }

      const sourceIds = [...new Set(references.map(ref => ref.id))];
      const monthValues = await this.fetchMonthValues(sourceIds, month, year);

      const valuesMap = {};
      const missingDependencies = new Set();

      for (const ref of references) {
        const typeNeeded = ref.suffix || valueType;
        const value = monthValues.get(`${ref.id}:${typeNeeded}`);

        if (value === undefined) {
          missingDependencies.add(ref.suffix ? `v${ref.id}:${ref.suffix}` : `v${ref.id}`);
          continue;
        }

        if (ref.cumulative) continue; // replaced by its cumulative total below
        if (ref.suffix) {
          valuesMap[`${ref.id}:${ref.suffix}`] = value;
        } else {
          valuesMap[ref.id] = value;
        }
      }

      // Check if any dependencies are missing - if so, do not compute to avoid misleading data
      if (missingDependencies.size > 0) {
        const missing = [...missingDependencies].join(', ');
        console.warn(`Cannot compute KPI Value ${kpiValueId} (${kpiValue.data}) for ${month}/${year}: Missing dependencies: ${missing}`);
        throw new Error(`Missing required dependencies: ${missing}. All dependent values must be available for accurate computation.`);
      }

      // Pre-process CUMSUM(v<ID>) expressions to concrete numeric values
      let processedFormula = formulaToUse;
      const cumulativeIds = [...new Set(references.filter(ref => ref.cumulative).map(ref => ref.id))];
      for (const sourceId of cumulativeIds) {
        const cumVal = await this.computeCumulativeSumForSource(sourceId, month, year, valueType);
        // Replace all occurrences of this exact CUMSUM(v<id>) token with computed value
        const tokenRegex = new RegExp(`CUMSUM\\(\\s*v?${sourceId}\\s*\\)`, 'gi');
        processedFormula = processedFormula.replace(tokenRegex, `(${cumVal})`);
      }

      // Evaluate the (possibly preprocessed) formula
      const evaluator = new FormulaEvaluator(valuesMap);
      const result = evaluator.evaluate(processedFormula);

      // Get the unit of measurement for this KPI value to determine rounding
      const unitResult = await pool.query(
        `SELECT u.symbol, u.unit_name
         FROM kpi_values kv
         LEFT JOIN unit_master u ON kv.uom = u.id
         WHERE kv.id = $1`,
        [kpiValueId]
      );

      const unit = unitResult.rows[0];
      const unitSymbol = unit?.symbol?.toLowerCase() || '';
      const unitName = unit?.unit_name?.toLowerCase() || '';

      // Round based on unit type
      let roundedResult;
      if (unitSymbol === '%' || unitName.includes('percent')) {
        // Percentages: round to whole number (no decimals)
        roundedResult = Math.round(result);
      } else {
        // Ratios and other values: round to 2 decimal places
        roundedResult = Math.round(result * 100) / 100;
      }

      return roundedResult;
    } catch (error) {
      console.error('Error calculating KPI value:', error.message);
      throw error;
    }
  }

  /**
   * Recalculate and store one computed KPI for one month.
   * @param {object} kpi - row with id, data, formula, target_formula, target_required, default_target_value
   * @param {object} options.applyDefaultTarget - store default_target_value when the target cannot be computed
   */
  static async recalculateKPIForMonth(kpi, month, year, empId, { applyDefaultTarget = true } = {}) {
    // Actual value: only KPIs with an actual formula compute their actual
    if (kpi.formula) {
      try {
        const calculatedValue = await this.calculateKPIValue(kpi.id, month, year, empId, 'actual');
        if (isValidNumber(calculatedValue)) {
          await pool.query(UPSERT_DATA_VALUE_SQL, [kpi.id, calculatedValue, 'actual', month, year]);
          console.log(`[RECALC] ✓ Saved ${kpi.data} actual for ${month}/${year}: ${calculatedValue}`);
        }
      } catch (error) {
        console.warn(`[RECALC] Skipped ${kpi.data} actual for ${month}/${year}: ${error.message}`);
      }
    }

    // Target value: computed when the KPI has a target formula, or requires a target
    // (in which case the actual formula is applied to the source targets)
    if (kpi.target_formula || kpi.target_required) {
      const hasDefaultTarget = kpi.default_target_value !== null && kpi.default_target_value !== undefined;
      let targetToSave = null;

      try {
        targetToSave = await this.calculateKPIValue(kpi.id, month, year, empId, 'target');
      } catch (error) {
        console.warn(`[RECALC] Could not calculate ${kpi.data} target for ${month}/${year}: ${error.message}`);
        if (applyDefaultTarget && hasDefaultTarget) {
          targetToSave = parseFloat(kpi.default_target_value);
        }
      }

      if (isValidNumber(targetToSave)) {
        await pool.query(UPSERT_DATA_VALUE_SQL, [kpi.id, targetToSave, 'target', month, year]);
        console.log(`[RECALC] ✓ Saved ${kpi.data} target for ${month}/${year}: ${targetToSave}`);
      }
    }
  }

  /**
   * Find computed KPIs whose actual or target formula depends on a KPI value.
   * @returns {Promise<{kpi: object, cumulative: boolean}[]>}
   */
  static async findDependentKPIs(sourceKpiValueId) {
    const sourceId = Number(sourceKpiValueId);
    const allComputed = await pool.query(
      `SELECT id, data, formula, target_formula, source_kpi_value_ids, target_source_kpi_value_ids,
              target_required, default_target_value
       FROM kpi_values
       WHERE LOWER(kpi_type) = 'computed'`
    );

    const dependents = [];
    for (const kpi of allComputed.rows || []) {
      const references = [...safeReferences(kpi.formula), ...safeReferences(kpi.target_formula)]
        .filter(ref => ref.id === sourceId);
      const inSourceArrays = [kpi.source_kpi_value_ids, kpi.target_source_kpi_value_ids]
        .some(ids => Array.isArray(ids) && ids.map(Number).includes(sourceId));

      if (references.length > 0 || inSourceArrays) {
        dependents.push({ kpi, cumulative: references.some(ref => ref.cumulative) });
      }
    }
    return dependents;
  }

  /** Months (after the given one) in the same fiscal year where a KPI already has stored values. */
  static async getLaterMonthsWithData(kpiValueId, month, year) {
    const laterMonths = getLaterFiscalMonths(month, year);
    if (laterMonths.length === 0) return [];

    const result = await pool.query(
      `SELECT DISTINCT month, year FROM kpi_data_value WHERE kpi_value_id = $1`,
      [kpiValueId]
    );
    const stored = new Set(result.rows.map(row => `${row.month}_${row.year}`));
    return laterMonths.filter(({ month: m, year: y }) => stored.has(`${m}_${y}`));
  }

  /**
   * Recalculate all computed KPIs that depend on a given KPI value
   * @param {number} sourceKpiValueId - The KPI value that was updated
   * @param {number} month
   * @param {number} year
   * @param {number} empId
   * @param {Set<number>} chain - KPI ids already being recalculated on this path (guards against circular formulas)
   */
  static async recalculateDependentKPIs(sourceKpiValueId, month, year, empId, chain = new Set()) {
    const sourceId = Number(sourceKpiValueId);
    const path = new Set(chain);
    path.add(sourceId);

    const dependents = await this.findDependentKPIs(sourceId);
    if (dependents.length === 0) return;

    console.log(`[RECALC] ${dependents.length} KPI(s) depend on KPI value ${sourceId} (${month}/${year})`);

    for (const { kpi, cumulative } of dependents) {
      const kpiId = Number(kpi.id);
      if (path.has(kpiId)) {
        console.warn(`[RECALC] Circular dependency detected: KPI value ${kpiId} (${kpi.data}) depends on itself. Skipping.`);
        continue;
      }

      try {
        await this.recalculateKPIForMonth(kpi, month, year, empId);
        await this.recalculateDependentKPIs(kpiId, month, year, empId, path);

        // A cumulative (CUMSUM) dependency also changes every later month of the fiscal year.
        // Only months that were already calculated are refreshed; no new months are created.
        if (cumulative) {
          const laterMonths = await this.getLaterMonthsWithData(kpiId, month, year);
          for (const later of laterMonths) {
            await this.recalculateKPIForMonth(kpi, later.month, later.year, empId, { applyDefaultTarget: false });
            await this.recalculateDependentKPIs(kpiId, later.month, later.year, empId, path);
          }
        }
      } catch (error) {
        // Continue with other KPIs even if one fails
        console.error(`[RECALC] ✗ Failed to recalculate KPI ${kpi.data}:`, error.message);
      }
    }
  }

  /**
   * Calculate all computed KPIs for an employee for a specific month/year
   * @param {number} empId
   * @param {number} month
   * @param {number} year
   */
  static async calculateAllForEmployee(empId, month, year) {
    try {
      // Get all computed KPI values assigned to this employee
      const computedKPIsResult = await pool.query(
        `SELECT DISTINCT kv.id, kv.data, kv.formula, kv.target_formula, kv.target_required, kv.default_target_value
         FROM kpi_values kv
         JOIN kpis k ON k.id = kv.kpi_id
         JOIN kpi_emp ke ON ke.kpi_id = k.id
         WHERE ke.emp_id = $1 AND LOWER(kv.kpi_type) = 'computed'`,
        [empId]
      );

      for (const kpi of computedKPIsResult.rows) {
        await this.recalculateKPIForMonth(kpi, month, year, empId);
      }
    } catch (error) {
      console.error('Error calculating all KPIs for employee:', error);
      throw error;
    }
  }

  /**
   * Validate the formulas of a computed KPI value before saving.
   * Checks syntax, that every referenced KPI value exists, and that the formulas
   * do not (directly or indirectly) depend on the KPI value itself.
   * @param {{kpiValueId?: number, formula?: string, targetFormula?: string}} params
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  static async validateComputedFormulas({ kpiValueId = null, formula, targetFormula }) {
    const formulas = [
      { label: 'Formula', text: formula },
      { label: 'Target formula', text: targetFormula }
    ].filter(f => hasValue(f.text));

    const referencedIds = new Set();
    for (const { label, text } of formulas) {
      const syntaxError = FormulaEvaluator.getFormulaError(text);
      if (syntaxError) {
        return { valid: false, error: `${label} is invalid: ${syntaxError}` };
      }
      FormulaEvaluator.extractSourceKpiIds(text).forEach(id => referencedIds.add(id));
    }

    const ids = [...referencedIds];
    if (ids.length === 0) return { valid: true };

    const ownId = kpiValueId !== null && kpiValueId !== undefined ? Number(kpiValueId) : null;
    if (ownId !== null && referencedIds.has(ownId)) {
      return { valid: false, error: `A KPI value cannot reference itself (v${ownId})` };
    }

    // Verify all source IDs exist in database
    const existing = await pool.query(`SELECT id FROM kpi_values WHERE id = ANY($1::bigint[])`, [ids]);
    const existingIds = new Set(existing.rows.map(row => Number(row.id)));
    const missingIds = ids.filter(id => !existingIds.has(id));
    if (missingIds.length > 0) {
      return { valid: false, error: `Formula references KPI values that do not exist: v${missingIds.join(', v')}` };
    }

    if (ownId !== null) {
      return this.checkCircularDependency(ownId, ids);
    }
    return { valid: true };
  }

  /**
   * Check whether any of the given source KPI values depend (through their own
   * formulas) on the KPI value being saved.
   */
  static async checkCircularDependency(kpiValueId, sourceKpiValueIds) {
    const target = Number(kpiValueId);
    const visited = new Set();
    const queue = [...sourceKpiValueIds.map(Number)];

    while (queue.length > 0) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      const result = await pool.query(
        `SELECT formula, target_formula, source_kpi_value_ids, target_source_kpi_value_ids
         FROM kpi_values
         WHERE id = $1 AND LOWER(kpi_type) = 'computed'`,
        [id]
      );
      const row = result.rows[0];
      if (!row) continue;

      const nested = new Set([
        ...FormulaEvaluator.extractSourceKpiIds(row.formula),
        ...FormulaEvaluator.extractSourceKpiIds(row.target_formula),
        ...(row.source_kpi_value_ids || []).map(Number),
        ...(row.target_source_kpi_value_ids || []).map(Number)
      ]);

      if (nested.has(target)) {
        return { valid: false, error: `Circular dependency detected: v${id} already depends on this KPI value (v${target})` };
      }
      nested.forEach(n => { if (!visited.has(n)) queue.push(n); });
    }

    return { valid: true };
  }
}
module.exports = KPICalculationService;
