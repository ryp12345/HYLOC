const pool = require('../config/db');

// Get all KPI values assigned to an employee as data operator
exports.getEmployeeKPIValues = async (req, res) => {
  try {
    const { empId } = req.params;

    if (!empId) {
      return res.status(400).json({ success: false, error: 'empId is required' });
    }

    // Convert empId to integer to match database type
    const empIdInt = parseInt(empId, 10);

    const valuesResult = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator", kv.target_required, 
              kv.uom, kv.kpi_type, kv.piller_id, kv.formula, kv.source_kpi_value_ids,
              kv.default_target_value, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE kv."data operator" = $1
       ORDER BY kv.created_at DESC`,
      [empIdInt]
    );

    res.json({ success: true, data: valuesResult.rows });
  } catch (error) {
    console.error('Error in getEmployeeKPIValues:', error);
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

    // Convert empId to integer to match database type
    const empIdInt = parseInt(empId, 10);

    // Get all unique KPIs where employee is data operator
    const kpisResult = await pool.query(
      `SELECT DISTINCT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              k.created_at, k.updated_at
       FROM kpi_values kv
       JOIN kpis k ON k.id = kv.kpi_id
       WHERE kv."data operator" = $1
       ORDER BY k.parent_kpi_id NULLS FIRST, k.title`,
      [empIdInt]
    );

    res.json({ success: true, data: kpisResult.rows });
  } catch (error) {
    console.error('Error in getEmployeeKPIs:', error);
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

    // Convert empId to integer to match database type
    const empIdInt = parseInt(empId, 10);

    const valuesResult = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator", kv.target_required, 
              kv.uom, kv.kpi_type, kv.piller_id, kv.formula, kv.source_kpi_value_ids,
              kv.default_target_value, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE kv.kpi_id = $1 AND kv."data operator" = $2
       ORDER BY kv.created_at DESC`,
      [kpiId, empIdInt]
    );

    res.json({ success: true, data: valuesResult.rows });
  } catch (error) {
    console.error('Error in getKPIValueForEmployee:', error);
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

    const results = [];

    // Handle target value
    if (targetValue !== null && targetValue !== undefined && targetValue !== '') {
      // Check if target entry exists
      const existingTarget = await pool.query(
        `SELECT id FROM kpi_data_value 
         WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
        [kpiValueId, month, year, 'target']
      );

      if (existingTarget.rows.length > 0) {
        // Update existing target
        const targetResult = await pool.query(
          `UPDATE kpi_data_value
           SET value = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [parseFloat(targetValue), existingTarget.rows[0].id]
        );
        results.push(targetResult.rows[0]);
      } else {
        // Insert new target
        const targetResult = await pool.query(
          `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [kpiValueId, parseFloat(targetValue), 'target', month, year]
        );
        results.push(targetResult.rows[0]);
      }
    }

    // Handle actual value
    if (actualValue !== null && actualValue !== undefined && actualValue !== '') {
      // Check if actual entry exists
      const existingActual = await pool.query(
        `SELECT id FROM kpi_data_value 
         WHERE kpi_value_id = $1 AND month = $2 AND year = $3 AND value_type = $4`,
        [kpiValueId, month, year, 'actual']
      );

      if (existingActual.rows.length > 0) {
        // Update existing actual
        const actualResult = await pool.query(
          `UPDATE kpi_data_value
           SET value = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [parseFloat(actualValue), existingActual.rows[0].id]
        );
        results.push(actualResult.rows[0]);
      } else {
        // Insert new actual
        const actualResult = await pool.query(
          `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [kpiValueId, parseFloat(actualValue), 'actual', month, year]
        );
        results.push(actualResult.rows[0]);
      }
    }

    res.json({ success: true, message: 'KPI data submitted successfully', data: results });
  } catch (error) {
    console.error('Error in submitKPIData:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
