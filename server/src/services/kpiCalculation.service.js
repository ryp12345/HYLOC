const pool = require('../config/db');
const FormulaEvaluator = require('../utils/formulaEvaluator');

// Simple in-memory memoization for CUMSUM within a single process
const cumsumCache = new Map();

class KPICalculationService {
  /**
   * Compute cumulative sum for a base KPI value from April to the given month within fiscal year.
   * Fiscal year: Apr (4) .. Dec (12) of previous calendar year + Jan (1) .. Mar (3) of current calendar year.
   * @param {number} sourceKpiValueId
   * @param {number} month - calendar month (1-12)
   * @param {number} year - calendar year of the target month
   * @returns {Promise<number>}
   */
  static async computeCumulativeSumForSource(sourceKpiValueId, month, year, valueType = 'actual') {
    // console.log(`[CUMSUM] ==========================================`);
    // console.log(`[CUMSUM] Computing cumulative ${valueType} for KPI Value ${sourceKpiValueId}`);
    // console.log(`[CUMSUM] Target month: ${month}, Target year: ${year}`);

    const cacheKey = `${sourceKpiValueId}:${month}:${year}:${valueType}`;
    if (cumsumCache.has(cacheKey)) {
      const cached = cumsumCache.get(cacheKey);
      console.log(`[CUMSUM] Cache hit for ${cacheKey}: ${cached}`);
      return cached;
    }

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
    const kpiName = kpiData?.data;
    const isPercentage = unitSymbol === '%' || (unitSymbol && unitSymbol.toLowerCase().includes('percent'));

    console.log(`[CUMSUM] KPI: ${kpiName}, Unit: ${unitSymbol}`);

    // Build query conditions for fiscal range (April to current month)
    let query;
    let params;

    if (month >= 4) {
      // Target month is April-December: sum April..month of same calendar year
      console.log(`[CUMSUM] Month ${month} is Apr-Dec: Querying April-${month} of year ${year}`);
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
      console.log(`[CUMSUM] Month ${month} is Jan-Mar: Querying April-Dec ${year-1} + Jan-${month} ${year}`);
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

    console.log(`[CUMSUM] SQL Query parameters:`, params);
    const result = await pool.query(query, params);
    let total = result.rows?.[0]?.total;
    let num = parseFloat(total);

    console.log(`[CUMSUM] Raw total from DB: ${total}, parsed: ${num}`);

    // Debug: Show what data exists for this KPI
    const debugData = await pool.query(
      `SELECT month, year, value, value_type 
       FROM kpi_data_value 
       WHERE kpi_value_id = $1 
       ORDER BY year, month`,
      [sourceKpiValueId]
    );
    console.log(`[CUMSUM] Available data for KPI ${sourceKpiValueId}:`, debugData.rows);

    // If unit is percentage, divide by 100
    if (isPercentage && !isNaN(num)) {
      console.log(`[CUMSUM] Converting percentage: ${num} / 100 = ${num / 100}`);
      num = num / 100;
    }

    // Round based on unit type
    let roundedValue;
    if (isPercentage) {
      // Percentages: round to whole number (no decimals)
      roundedValue = Math.round(num);
    } else {
      // Other values: round to 2 decimal places
      roundedValue = Math.round(num * 100) / 100;
    }
    
    const finalValue = isNaN(num) ? 0 : roundedValue;
    cumsumCache.set(cacheKey, finalValue);
    // console.log(`[CUMSUM] ✓ Final cumulative ${valueType} value: ${finalValue}`);
    // console.log(`[CUMSUM] ==========================================`);
    return finalValue;
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

      // Determine which formula to use based on valueType
      let formulaToUse;
      let sourceIdsRaw;
      
      if (valueType === 'target' && kpiValue.target_formula) {
        // Use target-specific formula for target calculation
        formulaToUse = kpiValue.target_formula;
        sourceIdsRaw = kpiValue.target_source_kpi_value_ids || [];
      } else {
        // Use actual formula for actual calculation or fallback for target
        formulaToUse = kpiValue.formula;
        sourceIdsRaw = kpiValue.source_kpi_value_ids || [];
      }

      if (!formulaToUse) {
        throw new Error(`KPI Value ${kpiValueId} has no formula defined for ${valueType}`);
      }

      // Get the actual values for all source KPI values for this month/year
      let sourceIds = sourceIdsRaw;
      if (!sourceIds || sourceIds.length === 0) {
        sourceIds = FormulaEvaluator.extractSourceKpiIds(formulaToUse);
      }
      
      if (sourceIds.length === 0) {
        throw new Error(`No source KPI values defined for ${kpiValue.data} ${valueType}`);
      }

      // Fetch values for all dependencies (actual or target based on valueType)
      const valuesMap = {};
      const missingDependencies = []; // Track missing values
      
      for (const sourceId of sourceIds) {
        // Check if formula explicitly requests both actual and target from this source
        const needsActual = formulaToUse.match(new RegExp(`v${sourceId}:actual`, 'i'));
        const needsTarget = formulaToUse.match(new RegExp(`v${sourceId}:target`, 'i'));
        const needsDefault = formulaToUse.match(new RegExp(`v${sourceId}(?!:)`, 'i'));
        
        // Fetch actual value if explicitly requested or if default and valueType is 'actual'
        if (needsActual || (needsDefault && valueType === 'actual')) {
          const actualResult = await pool.query(
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

          if (actualResult.rows.length > 0) {
            const value = parseFloat(actualResult.rows[0].value);
            if (value === null || value === undefined || isNaN(value)) {
              console.warn(`Invalid actual value for KPI Value ${sourceId} for ${month}/${year}`);
              missingDependencies.push(`v${sourceId}:actual`);
            } else {
              valuesMap[`${sourceId}:actual`] = value;
              if (!needsTarget && !needsDefault) {
                valuesMap[sourceId] = value; // For backward compatibility
              }
            }
          } else {
            console.warn(`No actual data found for KPI Value ${sourceId} for ${month}/${year}`);
            missingDependencies.push(`v${sourceId}:actual`);
          }
        }
        
        // Fetch target value if explicitly requested or if default and valueType is 'target'
        if (needsTarget || (needsDefault && valueType === 'target')) {
          const targetResult = await pool.query(
            `SELECT value
             FROM kpi_data_value
             WHERE kpi_value_id = $1 
               AND month = $2 
               AND year = $3
               AND value_type = 'target'
             ORDER BY created_at DESC
             LIMIT 1`,
            [sourceId, month, year]
          );

          if (targetResult.rows.length > 0) {
            const value = parseFloat(targetResult.rows[0].value);
            if (value === null || value === undefined || isNaN(value)) {
              console.warn(`Invalid target value for KPI Value ${sourceId} for ${month}/${year}`);
              missingDependencies.push(`v${sourceId}:target`);
            } else {
              valuesMap[`${sourceId}:target`] = value;
              if (!needsActual && !needsDefault) {
                valuesMap[sourceId] = value; // For backward compatibility
              }
            }
          } else {
            console.warn(`No target data found for KPI Value ${sourceId} for ${month}/${year}`);
            missingDependencies.push(`v${sourceId}:target`);
          }
        }
        
        // Handle default v<id> pattern (fetch based on valueType)
        if (needsDefault && !needsActual && !needsTarget) {
          const valueResult = await pool.query(
            `SELECT value
             FROM kpi_data_value
             WHERE kpi_value_id = $1 
               AND month = $2 
               AND year = $3
               AND value_type = $4
             ORDER BY created_at DESC
             LIMIT 1`,
            [sourceId, month, year, valueType]
          );

          if (valueResult.rows.length > 0) {
            const value = parseFloat(valueResult.rows[0].value);
            if (value === null || value === undefined || isNaN(value)) {
              console.warn(`Invalid ${valueType} value for KPI Value ${sourceId} for ${month}/${year}`);
              missingDependencies.push(`v${sourceId}`);
            } else {
              valuesMap[sourceId] = value;
            }
          } else {
            console.warn(`No ${valueType} data found for KPI Value ${sourceId} for ${month}/${year}`);
            missingDependencies.push(`v${sourceId}`);
          }
        }
      }

      // Check if any dependencies are missing - if so, do not compute to avoid misleading data
      if (missingDependencies.length > 0) {
        console.warn(`Cannot compute KPI Value ${kpiValueId} (${kpiValue.data}) for ${month}/${year}: Missing dependencies: ${missingDependencies.join(', ')}`);
        throw new Error(`Missing required dependencies: ${missingDependencies.join(', ')}. All dependent values must be available for accurate computation.`);
      }

      // Pre-process CUMSUM(v<ID>) expressions to concrete numeric values
      let processedFormula = formulaToUse;
      const cumsumRegex = /CUMSUM\(\s*v?(\d+)\s*\)/gi;
      const cumsumMatches = processedFormula.match(cumsumRegex) || [];
      if (cumsumMatches.length > 0) {
        processedFormula = await (async () => {
          let expr = processedFormula;
          const seen = new Set();
          for (const m of cumsumMatches) {
            const idMatch = /v?(\d+)/i.exec(m);
            if (!idMatch) continue;
            const sourceId = parseInt(idMatch[1]);
            if (Number.isNaN(sourceId)) continue;
            // Avoid duplicate queries for same sourceId in formula
            if (!seen.has(sourceId)) {
              seen.add(sourceId);
              const cumVal = await KPICalculationService.computeCumulativeSumForSource(sourceId, month, year, valueType);
              // Replace all occurrences of this exact CUMSUM(v<id>) token with computed value
              const tokenRegex = new RegExp(`CUMSUM\\(\\s*v?${sourceId}\\s*\\)`, 'gi');
              expr = expr.replace(tokenRegex, String(cumVal));
            }
          }
          return expr;
        })();
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
      let roundedResult = result;
      if (unitSymbol === '%' || unitName.includes('percent')) {
        // Percentages: round to whole number (no decimals)
        roundedResult = Math.round(result);
      } else if (unitSymbol === 'ratio' || unitName.includes('ratio')) {
        // Ratios: round to 2 decimal places
        roundedResult = Math.round(result * 100) / 100;
      } else {
        // Other values: round to 2 decimal places
        roundedResult = Math.round(result * 100) / 100;
      }

      // console.log(`Calculated ${kpiValue.data}: ${roundedResult} (original: ${result}, month: ${month}, year: ${year})`);
      return roundedResult;
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
      console.log(`[RECALC] ========================================`);
      console.log(`[RECALC] Starting recalculation for source KPI Value ID: ${sourceKpiValueId}, month: ${month}, year: ${year}, empId: ${empId}`);
      console.log(`[RECALC] ========================================`);
      
      // Strategy: Always scan all computed KPIs for dependencies
      // Check both source_kpi_value_ids arrays AND formula text
      let dependentKPIs = [];
      
      try {
        const allComputed = await pool.query(
          `SELECT id, formula, source_kpi_value_ids, data, target_required, default_target_value
           FROM kpi_values
           WHERE LOWER(kpi_type) = 'computed'`
        );

        console.log(`[RECALC] Scanning ${allComputed.rows.length} computed KPIs for dependencies...`);
        console.log(`[RECALC] Looking for KPIs that depend on source ID: ${sourceKpiValueId}`);

        // Match v153 directly or within CUMSUM(v153) or CUMSUM(153)
        const vPattern = new RegExp(`\\bv${sourceKpiValueId}\\b`, 'i');
        const cumsumPattern = new RegExp(`CUMSUM\\s*\\(\\s*v?${sourceKpiValueId}\\s*\\)`, 'i');
        
        console.log(`[RECALC] Patterns to match:`);
        console.log(`[RECALC]   - v pattern: \\bv${sourceKpiValueId}\\b`);
        console.log(`[RECALC]   - CUMSUM pattern: CUMSUM\\s*\\(\\s*v?${sourceKpiValueId}\\s*\\)`);
        
        dependentKPIs = (allComputed.rows || []).filter(kpi => {
          // Check if sourceId is in dependency arrays
          const inSourceArray = kpi.source_kpi_value_ids && kpi.source_kpi_value_ids.includes(sourceKpiValueId);
          
          // Check if formula contains the pattern
          const matchesV = kpi.formula ? vPattern.test(kpi.formula) : false;
          const matchesCumsum = kpi.formula ? cumsumPattern.test(kpi.formula) : false;
          
          const matches = inSourceArray || matchesV || matchesCumsum;
          
          // Log every KPI checked
          console.log(`[RECALC] ${matches ? '✓' : '✗'} KPI: ${kpi.data} (ID: ${kpi.id})`);
          console.log(`[RECALC]     Formula: "${kpi.formula || 'NO FORMULA'}"`);
          console.log(`[RECALC]     Source array: ${JSON.stringify(kpi.source_kpi_value_ids)}`);
          console.log(`[RECALC]     In source array: ${inSourceArray}`);
          console.log(`[RECALC]     Matches v${sourceKpiValueId}: ${matchesV}`);
          console.log(`[RECALC]     Matches CUMSUM(v${sourceKpiValueId}): ${matchesCumsum}`);
          
          return matches;
        });
        
        console.log(`[RECALC] ========================================`);
        console.log(`[RECALC] Found ${dependentKPIs.length} dependent KPIs total`);
        if (dependentKPIs.length > 0) {
          dependentKPIs.forEach(dep => {
            console.log(`[RECALC]   ✓ ${dep.data} (ID: ${dep.id})`);
          });
        } else {
          console.log(`[RECALC]   ⚠ No dependents found! Check if:`);
          console.log(`[RECALC]     1. Computed KPIs have formulas containing v${sourceKpiValueId} or CUMSUM(v${sourceKpiValueId})`);
          console.log(`[RECALC]     2. Source KPI value IDs array includes ${sourceKpiValueId}`);
        }
        console.log(`[RECALC] ========================================`);
      } catch (error) {
        console.error('[RECALC] Error scanning for dependencies:', error);
        throw error;
      }
      
      if (!dependentKPIs || dependentKPIs.length === 0) {
        console.log(`[RECALC] No dependent KPIs found for source ${sourceKpiValueId}`);
        return;
      }

      console.log(`[RECALC] Processing ${dependentKPIs.length} dependent KPIs...`);

      for (const kpi of dependentKPIs) {
        try {
          console.log(`[RECALC] ----------------------------------------`);
          console.log(`[RECALC] Computing ${kpi.data} (ID: ${kpi.id})...`);
          console.log(`[RECALC] Formula: ${kpi.formula}`);
          console.log(`[RECALC] Target required: ${kpi.target_required}`);
          console.log(`[RECALC] Default target: ${kpi.default_target_value}`);
          
          // Calculate actual value
          const calculatedValue = await this.calculateKPIValue(kpi.id, month, year, empId, 'actual');
          
          console.log(`[RECALC] Calculated ${kpi.data} actual value: ${calculatedValue}`);
          
          // Only insert if value is valid
          if (calculatedValue !== null && calculatedValue !== undefined && !Number.isNaN(calculatedValue)) {
            // Update or insert the calculated actual value
            const insertResult = await pool.query(
              `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
               VALUES ($1, $2, 'actual', $3, $4)
               ON CONFLICT (kpi_value_id, month, year, value_type)
               DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
               RETURNING *`,
              [kpi.id, calculatedValue, month, year]
            );

            console.log(`[RECALC] ✓ Saved ${kpi.data} actual: ${calculatedValue}`);
            console.log(`[RECALC] DB record ID: ${insertResult.rows[0]?.id}`);
          } else {
            console.log(`[RECALC] ✗ Skipped saving actual - invalid value: ${calculatedValue}`);
          }
          
          // If target is required, also calculate target value
          if (kpi.target_required) {
            try {
              console.log(`[RECALC] Calculating target for ${kpi.data}...`);
              const calculatedTarget = await this.calculateKPIValue(kpi.id, month, year, empId, 'target');
              
              console.log(`[RECALC] Calculated ${kpi.data} target value: ${calculatedTarget}`);
              
              // Use default_target_value only if calculation failed (NaN) or threw error
              const hasDefaultTarget = kpi.default_target_value !== null && kpi.default_target_value !== undefined;
              const targetToSave = Number.isNaN(calculatedTarget) && hasDefaultTarget
                ? parseFloat(kpi.default_target_value)
                : calculatedTarget;
              
              console.log(`[RECALC] Target to save: ${targetToSave} (calculated: ${calculatedTarget}, hasDefault: ${hasDefaultTarget}, defaultValue: ${kpi.default_target_value})`);
              
              // Only insert if targetToSave is valid
              if (targetToSave !== null && targetToSave !== undefined && !Number.isNaN(targetToSave)) {
                // Update or insert the calculated target value
                const targetInsertResult = await pool.query(
                  `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
                   VALUES ($1, $2, 'target', $3, $4)
                   ON CONFLICT (kpi_value_id, month, year, value_type)
                   DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                   RETURNING *`,
                  [kpi.id, targetToSave, month, year]
                );

                console.log(`[RECALC] ✓ Saved ${kpi.data} target: ${targetToSave}`);
                console.log(`[RECALC] DB record ID: ${targetInsertResult.rows[0]?.id}`);
              } else {
                console.log(`[RECALC] ✗ Skipped saving target - invalid value: ${targetToSave}`);
              }
            } catch (error) {
              console.error(`[RECALC] Failed to calculate target for KPI ${kpi.data}:`, error.message);
              if (error.message && error.message.includes('Missing required dependencies')) {
                console.warn(`[RECALC] ⚠ Cannot calculate target for ${kpi.data} - missing dependency data.`);
              } else {
                console.error(`[RECALC] Target error stack:`, error.stack);
              }
              // If calculation failed and there's a default, use it
              if (kpi.default_target_value !== null && kpi.default_target_value !== undefined) {
                try {
                  await pool.query(
                    `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
                     VALUES ($1, $2, 'target', $3, $4)
                     ON CONFLICT (kpi_value_id, month, year, value_type)
                     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                    [kpi.id, parseFloat(kpi.default_target_value), month, year]
                  );
                  console.log(`[RECALC] ✓ Used default target for ${kpi.data}: ${kpi.default_target_value}`);
                } catch (defaultError) {
                  console.error(`[RECALC] Failed to insert default target:`, defaultError.message);
                }
              }
            }
          }
          
          // Recursively recalculate any KPIs that depend on this one
          console.log(`[RECALC] Checking for dependencies of ${kpi.data} (ID: ${kpi.id})...`);
          await this.recalculateDependentKPIs(kpi.id, month, year, empId);
          console.log(`[RECALC] ----------------------------------------`);
        } catch (error) {
          console.error(`[RECALC] ✗ Failed to recalculate KPI ${kpi.data}:`, error.message);
          if (error.message && error.message.includes('Missing required dependencies')) {
            console.warn(`[RECALC] ⚠ Skipping ${kpi.data} - missing dependency data. This KPI will be calculated once all dependencies have values.`);
          } else {
            console.error('[RECALC] Error stack:', error.stack);
            console.error('[RECALC] Error details:', JSON.stringify(error, null, 2));
          }
          console.log(`[RECALC] ----------------------------------------`);
          // Continue with other KPIs even if one fails
        }
      }

      console.log(`[RECALC] ========================================`);
      console.log(`[RECALC] Completed recalculation for source ${sourceKpiValueId}`);
      console.log(`[RECALC] ========================================`);
    } catch (error) {
      console.error('[RECALC] ✗ Error recalculating dependent KPIs:', error);
      console.error('[RECALC] Stack:', error.stack);
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
        `SELECT DISTINCT kv.id, kv.formula, kv.source_kpi_value_ids, kv.data, kv.target_required, kv.default_target_value
         FROM kpi_values kv
         JOIN kpis k ON k.id = kv.kpi_id
         JOIN kpi_emp ke ON ke.kpi_id = k.id
         WHERE ke.emp_id = $1 AND LOWER(kv.kpi_type) = 'computed'`,
        [empId]
      );

      const computedKPIs = computedKPIsResult.rows;

      for (const kpi of computedKPIs) {
        try {
          // Calculate actual value
          const value = await this.calculateKPIValue(kpi.id, month, year, empId, 'actual');
          
          // Save the calculated actual value
          await pool.query(
            `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
             VALUES ($1, $2, 'actual', $3, $4)
             ON CONFLICT (kpi_value_id, month, year, value_type)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [kpi.id, value, month, year]
          );

          // If target is required, also calculate target value
          if (kpi.target_required) {
            try {
              const targetValue = await this.calculateKPIValue(kpi.id, month, year, empId, 'target');
              
              // Use default_target_value only if calculation failed (NaN) or threw error
              const hasDefaultTarget = kpi.default_target_value !== null && kpi.default_target_value !== undefined;
              const targetToSave = Number.isNaN(targetValue) && hasDefaultTarget
                ? parseFloat(kpi.default_target_value)
                : targetValue;
              
              // Save the calculated target value
              await pool.query(
                `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
                 VALUES ($1, $2, 'target', $3, $4)
                 ON CONFLICT (kpi_value_id, month, year, value_type)
                 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [kpi.id, targetToSave, month, year]
              );
            } catch (error) {
              console.error(`Failed to calculate target for KPI ${kpi.data}:`, error.message);
              // If calculation failed and there's a default, use it
              if (kpi.default_target_value !== null && kpi.default_target_value !== undefined) {
                await pool.query(
                  `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
                   VALUES ($1, $2, 'target', $3, $4)
                   ON CONFLICT (kpi_value_id, month, year, value_type)
                   DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                  [kpi.id, parseFloat(kpi.default_target_value), month, year]
                );
              }
            }
          }
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