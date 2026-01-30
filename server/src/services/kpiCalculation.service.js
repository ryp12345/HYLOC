const pool = require('../config/db');
const FormulaEvaluator = require('../utils/formulaEvaluator');

class KPICalculationService {
  /**
   * Compute cumulative sum for a base KPI value from April to the given month within fiscal year.
   * Fiscal year: Apr (4) .. Dec (12) of previous calendar year + Jan (1) .. Mar (3) of current calendar year.
   * @param {number} sourceKpiValueId
   * @param {number} month - calendar month (1-12)
   * @param {number} year - calendar year of the target month
   * @returns {Promise<number>}
   */
  static async computeCumulativeSumForSource(sourceKpiValueId, month, year) {
    // Build query conditions for fiscal range
    let query;
    let params;
    if (month >= 4) {
      // April..target month in same calendar year
      query = `SELECT COALESCE(SUM(value::numeric), 0) AS total
               FROM kpi_data_value
               WHERE kpi_value_id = $1
                 AND value_type = 'actual'
                 AND year = $2
                 AND month BETWEEN 4 AND $3`;
      params = [sourceKpiValueId, year, month];
    } else {
      // April..December of previous year + January..target month of current year
      query = `SELECT COALESCE(SUM(value::numeric), 0) AS total
               FROM kpi_data_value
               WHERE kpi_value_id = $1
                 AND value_type = 'actual'
                 AND (
                   (year = $2 AND month BETWEEN 4 AND 12)
                   OR (year = $3 AND month BETWEEN 1 AND $4)
                 )`;
      params = [sourceKpiValueId, year - 1, year, month];
    }

    const result = await pool.query(query, params);
    const total = result.rows?.[0]?.total;
    const num = parseFloat(total);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Calculate a computed KPI value for a specific month/year
   * @param {number} kpiValueId - The computed KPI value ID
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {number} empId - Employee ID
   * @returns {Promise<number>} - Calculated value
   */
  static async calculateKPIValue(kpiValueId, month, year, empId) {
    try {
      // Get the KPI value with its formula and dependencies
      const kpiValueResult = await pool.query(
        `SELECT id, formula, source_kpi_value_ids, kpi_type, data
         FROM kpi_values
         WHERE id = $1`,
        [kpiValueId]
      );

      const kpiValue = kpiValueResult.rows[0];
      
      if (!kpiValue) {
        throw new Error(`KPI Value ${kpiValueId} not found`);
      }

      if (kpiValue.kpi_type !== 'computed') {
        throw new Error(`KPI Value ${kpiValueId} is not a computed type`);
      }

      if (!kpiValue.formula) {
        throw new Error(`KPI Value ${kpiValueId} has no formula defined`);
      }

      // Get the actual values for all source KPI values for this month/year
      const sourceIds = kpiValue.source_kpi_value_ids || [];
      
      if (sourceIds.length === 0) {
        throw new Error(`No source KPI values defined for ${kpiValue.data}`);
      }

      // Fetch actual values for all dependencies
      const valuesMap = {};
      
      for (const sourceId of sourceIds) {
        const valueResult = await pool.query(
          `SELECT value
           FROM kpi_data_value
           WHERE kpi_value_id = $1 
             AND month = $2 
             AND year = $3
             AND value_type = 'actual'
           ORDER BY created_at DESC
           LIMIT 1`,
          [sourceId, month, year]
        );

        if (valueResult.rows.length > 0) {
          valuesMap[sourceId] = parseFloat(valueResult.rows[0].value) || 0;
        } else {
          console.warn(`No data found for KPI Value ${sourceId} for ${month}/${year}`);
          valuesMap[sourceId] = 0;
        }
      }

      // Pre-process CUMSUM(v<ID>) expressions to concrete numeric values
      let processedFormula = kpiValue.formula;
      const cumsumRegex = /CUMSUM\(\s*v(\d+)\s*\)/gi;
      const cumsumMatches = processedFormula.match(cumsumRegex) || [];
      if (cumsumMatches.length > 0) {
        processedFormula = await (async () => {
          let expr = processedFormula;
          const seen = new Set();
          for (const m of cumsumMatches) {
            const idMatch = /v(\d+)/i.exec(m);
            if (!idMatch) continue;
            const sourceId = parseInt(idMatch[1]);
            if (Number.isNaN(sourceId)) continue;
            // Avoid duplicate queries for same sourceId in formula
            if (!seen.has(sourceId)) {
              seen.add(sourceId);
              const cumVal = await KPICalculationService.computeCumulativeSumForSource(sourceId, month, year);
              // Replace all occurrences of this exact CUMSUM(v<id>) token with computed value
              const tokenRegex = new RegExp(`CUMSUM\\(\\s*v${sourceId}\\s*\\)`, 'gi');
              expr = expr.replace(tokenRegex, String(cumVal));
            }
          }
          return expr;
        })();
      }

      // Evaluate the (possibly preprocessed) formula
      const evaluator = new FormulaEvaluator(valuesMap);
      const result = evaluator.evaluate(processedFormula);

      // console.log(`Calculated ${kpiValue.data}: ${result} (month: ${month}, year: ${year})`);
      return result;
    } catch (error) {
      console.error('Error calculating KPI value:', error);
      throw error;
    }
  }

  /**
   * Recalculate all computed KPIs that depend on a given KPI value
   * @param {number} sourceKpiValueId - The KPI value that was updated
   * @param {number} month
   * @param {number} year
   * @param {number} empId
   */
  static async recalculateDependentKPIs(sourceKpiValueId, month, year, empId) {
    try {
      // Find all computed KPIs that depend on this source
      const dependentResult = await pool.query(
        `SELECT id, formula, source_kpi_value_ids, data
         FROM kpi_values
         WHERE kpi_type = 'computed'
           AND $1 = ANY(source_kpi_value_ids)`,
        [sourceKpiValueId]
      );

      const dependentKPIs = dependentResult.rows;
      
      // console.log(`Found ${dependentKPIs.length} dependent KPIs to recalculate for source ${sourceKpiValueId}`);

      for (const kpi of dependentKPIs) {
        try {
          const calculatedValue = await this.calculateKPIValue(kpi.id, month, year, empId);
          
          // Update or insert the calculated value
          await pool.query(
            `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
             VALUES ($1, $2, 'actual', $3, $4)
             ON CONFLICT (kpi_value_id, month, year, value_type)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [kpi.id, calculatedValue, month, year]
          );

          // console.log(`Recalculated ${kpi.data}: ${calculatedValue}`);
          
          // Recursively recalculate any KPIs that depend on this one
          await this.recalculateDependentKPIs(kpi.id, month, year, empId);
        } catch (error) {
          console.error(`Failed to recalculate KPI ${kpi.data}:`, error.message);
          // Continue with other KPIs even if one fails
        }
      }
    } catch (error) {
      console.error('Error recalculating dependent KPIs:', error);
      throw error;
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
        `SELECT DISTINCT kv.id, kv.formula, kv.source_kpi_value_ids, kv.data
         FROM kpi_values kv
         JOIN kpis k ON k.id = kv.kpi_id
         JOIN kpi_emp ke ON ke.kpi_id = k.id
         WHERE ke.emp_id = $1 AND kv.kpi_type = 'computed'`,
        [empId]
      );

      const computedKPIs = computedKPIsResult.rows;
      
      // console.log(`Calculating ${computedKPIs.length} computed KPIs for employee ${empId}`);

      for (const kpi of computedKPIs) {
        try {
          const value = await this.calculateKPIValue(kpi.id, month, year, empId);
          
          // Save the calculated value
          await pool.query(
            `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
             VALUES ($1, $2, 'actual', $3, $4)
             ON CONFLICT (kpi_value_id, month, year, value_type)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [kpi.id, value, month, year]
          );

          // console.log(`Calculated ${kpi.data} = ${value}`);
        } catch (error) {
          console.error(`Failed to calculate KPI ${kpi.data}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error calculating all KPIs for employee:', error);
      throw error;
    }
  }

  /**
   * Validate formula before saving
   */
  static async validateFormula(formula, sourceKpiValueIds) {
    try {
      // Basic syntax validation
      if (!FormulaEvaluator.validateFormula(formula)) {
        return { valid: false, error: 'Invalid formula syntax' };
      }

      // Extract IDs from formula
      const extractedIds = FormulaEvaluator.extractSourceKpiIds(formula);
      // console.log('DEBUG validateFormula:', { formula, extractedIds, sourceKpiValueIds });
      
      // Check if all referenced IDs exist in sourceKpiValueIds
      const missingIds = extractedIds.filter(id => !sourceKpiValueIds.includes(id));
      if (missingIds.length > 0) {
        return { 
          valid: false, 
          error: `Formula references KPI values not in dependencies: v${missingIds.join(', v')}` 
        };
      }

      // Check if there are unused dependencies
      const unusedIds = sourceKpiValueIds.filter(id => !extractedIds.includes(id));
      if (unusedIds.length > 0) {
        console.warn(`Source dependencies include unused IDs: ${unusedIds.join(', ')}`);
      }

      // Verify all source IDs exist in database
      const result = await pool.query(
        `SELECT id FROM kpi_values WHERE id = ANY($1::int[])`,
        [sourceKpiValueIds]
      );

      if (result.rows.length !== sourceKpiValueIds.length) {
        return { valid: false, error: 'Some source KPI values do not exist' };
      }

      // Check for circular dependencies
      const circularCheck = await this.checkCircularDependency(sourceKpiValueIds);
      if (!circularCheck.valid) {
        return circularCheck;
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check for circular dependencies in formula
   */
  static async checkCircularDependency(sourceKpiValueIds, visited = new Set()) {
    try {
      for (const id of sourceKpiValueIds) {
        if (visited.has(id)) {
          return { valid: false, error: `Circular dependency detected involving KPI value ${id}` };
        }

        visited.add(id);

        // Check if this source is itself a computed KPI with dependencies
        const result = await pool.query(
          `SELECT source_kpi_value_ids FROM kpi_values 
           WHERE id = $1 AND kpi_type = 'computed'`,
          [id]
        );

        if (result.rows.length > 0 && result.rows[0].source_kpi_value_ids) {
          const nestedDeps = result.rows[0].source_kpi_value_ids;
          const nestedCheck = await this.checkCircularDependency(nestedDeps, new Set(visited));
          if (!nestedCheck.valid) {
            return nestedCheck;
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
module.exports = KPICalculationService;