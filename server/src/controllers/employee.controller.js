const pool = require('../config/db');
const { logError } = require('../utils/logger');
const KPICalculationService = require('../services/kpiCalculation.service');

// Get all KPI values assigned to an employee as data operator
exports.getEmployeeKPIValues = async (req, res) => {
  try {
    const { empId } = req.params;

    if (!empId) {
      return res.status(400).json({ success: false, error: 'empId is required' });
    }

    const empIdInt = parseInt(empId, 10);

    const valuesResult = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, kv.target_required, 
              kv.uom, kv.kpi_type, kv.piller_id, kv.formula, kv.source_kpi_value_ids,
              kv.computation_type, kv.target_formula, kv.target_source_kpi_value_ids,
              kv.default_target_value, kv.created_at, kv.updated_at,
              k.title as kpi_title, u.unit_name, u.symbol as unit_symbol
       FROM kpi_values kv
       JOIN kpis k ON k.id = kv.kpi_id
       LEFT JOIN unit_master u ON u.id = kv.uom
       WHERE kv."data operator" = $1
       ORDER BY k.parent_kpi_id NULLS FIRST, k.title, kv.created_at DESC`,
      [empIdInt]
    );

    res.json({ success: true, data: valuesResult.rows });
  } catch (error) {
    await logError(error, 'employee.controller.getEmployeeKPIValues', req.user?.id);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all KPIs assigned to an employee as data operator
exports.getEmployeeKPIs = async (req, res) => {
  try {
    const { empId } = req.params;

    if (!empId) {
      return res.status(400).json({ success: false, error: 'empId is required' });
    }

    const empIdInt = parseInt(empId, 10);

    const kpisResult = await pool.query(
      `SELECT DISTINCT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              k.created_at, k.updated_at, c.category_name
       FROM kpi_values kv
       JOIN kpis k ON k.id = kv.kpi_id
       LEFT JOIN categories c ON c.id = k.category_id
       WHERE kv."data operator" = $1
       ORDER BY k.parent_kpi_id NULLS FIRST, k.title`,
      [empIdInt]
    );

    res.json({ success: true, data: kpisResult.rows });
  } catch (error) {
    await logError(error, 'employee.controller.getEmployeeKPIs', req.user?.id);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get KPI values for a specific KPI for an employee
exports.getKPIValueForEmployee = async (req, res) => {
  try {
    const { kpiId, empId } = req.params;

    if (!kpiId || !empId) {
      return res.status(400).json({ success: false, error: 'kpiId and empId are required' });
    }

    const empIdInt = parseInt(empId, 10);

    const valuesResult = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, kv.target_required, 
              kv.uom, kv.kpi_type, kv.piller_id, kv.formula, kv.source_kpi_value_ids,
              kv.computation_type, kv.target_formula, kv.target_source_kpi_value_ids,
              kv.default_target_value, kv.created_at, kv.updated_at,
              k.title as kpi_title, u.unit_name, u.symbol as unit_symbol
       FROM kpi_values kv
       JOIN kpis k ON k.id = kv.kpi_id
       LEFT JOIN unit_master u ON u.id = kv.uom
       WHERE kv.kpi_id = $1 AND kv."data operator" = $2
       ORDER BY kv.created_at DESC`,
      [kpiId, empIdInt]
    );

    res.json({ success: true, data: valuesResult.rows });
  } catch (error) {
    await logError(error, 'employee.controller.getKPIValueForEmployee', req.user?.id);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Submit KPI data entry (monthly data)
exports.submitKPIData = async (req, res) => {
  try {
    const { kpiId, empId, month, year, targetValue, actualValue, kpiValueId } = req.body;

    if (!kpiId || !empId || !month || !year || !kpiValueId) {
      return res.status(400).json({ 
        success: false, 
        error: 'kpiId, empId, month, year, and kpiValueId are required' 
      });
    }

    // Fetch kpi_value metadata to decide computed behavior
    const kpiValueResult = await pool.query(
      `SELECT kpi_type, default_target_value, target_formula, target_source_kpi_value_ids, formula FROM kpi_values WHERE id = $1`,
      [kpiValueId]
    );
    const kpiValueData = kpiValueResult.rows[0];
    const isComputed = kpiValueData && (kpiValueData.kpi_type || '').toLowerCase() === 'computed';
    const defaultTargetValue = kpiValueData?.default_target_value;
    const targetFormula = kpiValueData?.target_formula;
    const formula = kpiValueData?.formula;
    const hasTargetFormula = targetFormula !== null && targetFormula !== undefined && String(targetFormula).trim() !== '';
    const hasFormula = formula !== null && formula !== undefined && String(formula).trim() !== '';

    const results = [];
    let shouldRecalculate = false;
    let shouldComputeTarget = false;
    let shouldComputeActual = false;

    // Resolve target value using default if appropriate
    let resolvedTargetValue = targetValue;
    if (isComputed && (targetValue === null || targetValue === undefined || targetValue === '') && !hasTargetFormula && defaultTargetValue !== null && defaultTargetValue !== undefined) {
      resolvedTargetValue = defaultTargetValue;
    }

    if (hasTargetFormula && (targetValue === null || targetValue === undefined || targetValue === '')) {
      shouldComputeTarget = true;
    }

    if (isComputed && hasFormula && (actualValue === null || actualValue === undefined || actualValue === '') && (targetValue !== null && targetValue !== undefined && targetValue !== '')) {
      shouldComputeActual = true;
    }

    // Upsert target
    if (resolvedTargetValue !== null && resolvedTargetValue !== undefined && resolvedTargetValue !== '') {
      const existingTarget = await pool.query(
        `SELECT id FROM kpi_data_value 
         WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
        [kpiValueId, month, year, 'target']
      );

      if (existingTarget.rows.length > 0) {
        const targetResult = await pool.query(
          `UPDATE kpi_data_value
           SET value = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [parseFloat(resolvedTargetValue), existingTarget.rows[0].id]
        );
        results.push(targetResult.rows[0]);
        shouldRecalculate = true;
      } else {
        const targetResult = await pool.query(
          `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [kpiValueId, parseFloat(resolvedTargetValue), 'target', month, year]
        );
        results.push(targetResult.rows[0]);
        shouldRecalculate = true;
      }
    }

    // Upsert actual
    if (actualValue !== null && actualValue !== undefined && actualValue !== '') {
      const existingActual = await pool.query(
        `SELECT id FROM kpi_data_value 
         WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
        [kpiValueId, month, year, 'actual']
      );

      if (existingActual.rows.length > 0) {
        const actualResult = await pool.query(
          `UPDATE kpi_data_value
           SET value = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [parseFloat(actualValue), existingActual.rows[0].id]
        );
        results.push(actualResult.rows[0]);
        shouldRecalculate = true;
      } else {
        const actualResult = await pool.query(
          `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [kpiValueId, parseFloat(actualValue), 'actual', month, year]
        );
        results.push(actualResult.rows[0]);
        shouldRecalculate = true;
      }

      // compute target via target_formula if applicable
      if (shouldComputeTarget) {
        try {
          const computedTarget = await KPICalculationService.calculateKPIValue(kpiValueId, month, year, empId, 'target');
          if (computedTarget !== null && computedTarget !== undefined && !Number.isNaN(computedTarget)) {
            const existingTarget = await pool.query(
              `SELECT id FROM kpi_data_value 
               WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
              [kpiValueId, month, year, 'target']
            );

            if (existingTarget.rows.length > 0) {
              const targetResult = await pool.query(
                `UPDATE kpi_data_value
                 SET value = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [parseFloat(computedTarget), existingTarget.rows[0].id]
              );
              results.push(targetResult.rows[0]);
            } else {
              const targetResult = await pool.query(
                `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [kpiValueId, parseFloat(computedTarget), 'target', month, year]
              );
              results.push(targetResult.rows[0]);
            }
          }
        } catch (err) {
          // don't fail the request if computation fails
          await logError(err, 'employee.controller.computeTarget', req.user?.id);
        }
      }
    }

    // Option 2: compute actual using formula when appropriate
    if (shouldComputeActual) {
      try {
        const computedActual = await KPICalculationService.calculateKPIValue(kpiValueId, month, year, empId, 'actual');
        if (computedActual !== null && computedActual !== undefined && !Number.isNaN(computedActual)) {
          const existingActual = await pool.query(
            `SELECT id FROM kpi_data_value 
             WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
            [kpiValueId, month, year, 'actual']
          );

          if (existingActual.rows.length > 0) {
            const actualResult = await pool.query(
              `UPDATE kpi_data_value
               SET value = $1, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`,
              [parseFloat(computedActual), existingActual.rows[0].id]
            );
            results.push(actualResult.rows[0]);
          } else {
            const actualResult = await pool.query(
              `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [kpiValueId, parseFloat(computedActual), 'actual', month, year]
            );
            results.push(actualResult.rows[0]);
          }
        }
      } catch (err) {
        await logError(err, 'employee.controller.computeActual', req.user?.id);
      }
    }

    // Recalculate dependent computed KPIs once if anything changed
    if (shouldRecalculate) {
      try {
        await KPICalculationService.recalculateDependentKPIs(
          parseInt(kpiValueId),
          parseInt(month),
          parseInt(year),
          parseInt(empId)
        );
      } catch (calcErr) {
        await logError(calcErr, 'employee.controller.recalculateDependentKPIs', req.user?.id);
      }
    }

    res.json({ success: true, message: 'KPI data submitted successfully', data: results });
  } catch (error) {
    await logError(error, 'employee.controller.submitKPIData', req.user?.id);
    res.status(500).json({ success: false, error: error.message });
  }
};
