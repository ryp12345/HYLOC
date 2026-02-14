const pool = require('../config/db');

// Get all KPI values
exports.getAllKPIValues = async () => {
  try {
    const result = await pool.query(
      `SELECT id, data, kpi_id, "data operator" AS data_operator, target_required, uom, 
              kpi_type, piller_id, formula, source_kpi_value_ids, default_target_value,
              computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at
       FROM kpi_values ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllKPIValues:', error);
    throw error;
  }
};

// Get KPI values by KPI ID
exports.getKPIValuesByKPI = async (kpiId) => {
  try {
    const result = await pool.query(
      `SELECT id, data, kpi_id, "data operator" AS data_operator, target_required, uom,
              kpi_type, piller_id, formula, source_kpi_value_ids, default_target_value,
              computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at
       FROM kpi_values WHERE kpi_id = $1 ORDER BY created_at DESC`,
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIValuesByKPI:', error);
    throw error;
  }
};

// Get KPI value by ID
exports.getKPIValueById = async (id) => {
  try {
    const result = await pool.query(
      `SELECT id, data, kpi_id, "data operator" AS data_operator, target_required, uom,
              kpi_type, piller_id, formula, source_kpi_value_ids, default_target_value,
              computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at
       FROM kpi_values WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getKPIValueById:', error);
    throw error;
  }
};

// Get KPI value by data field (case-insensitive, trimmed match)
exports.getKPIValueByData = async (dataValue) => {
  try {
    const result = await pool.query(
      `SELECT id, data, kpi_id, "data operator" AS data_operator, target_required, uom,
              kpi_type, piller_id, formula, source_kpi_value_ids, default_target_value,
              computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at
       FROM kpi_values
       WHERE LOWER(TRIM(data)) = LOWER(TRIM($1))`,
      [dataValue]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getKPIValueByData:', error);
    throw error;
  }
};

// Create KPI value
exports.createKPIValue = async (kpiValue) => {
  try {
    const {
      data,
      kpi_id,
      data_operator,
      target_required = true,
      uom,
      kpi_type = 'manual',
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    } = kpiValue;

    const result = await pool.query(
      `INSERT INTO kpi_values 
       (data, kpi_id, "data operator", target_required, uom, kpi_type, piller_id, 
        formula, source_kpi_value_ids, default_target_value, computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING id, data, kpi_id, "data operator" AS data_operator, target_required, uom, kpi_type, 
                 piller_id, formula, source_kpi_value_ids, default_target_value, computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at`,
      [
        data,
        kpi_id,
        data_operator || null,
        target_required,
        uom || null,
        kpi_type,
        piller_id || null,
        formula || null,
        source_kpi_value_ids || null,
        default_target_value || null,
        kpiValue.computation_type || null,
        kpiValue.target_formula || null,
        kpiValue.target_source_kpi_value_ids || null
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createKPIValue:', error);
    throw error;
  }
};

// Update KPI value
exports.updateKPIValue = async (id, kpiValue) => {
  try {
    const {
      data,
      kpi_id,
      data_operator,
      target_required,
      uom,
      kpi_type,
      piller_id,
      formula,
      source_kpi_value_ids,
      default_target_value
    } = kpiValue;

    const result = await pool.query(
      `UPDATE kpi_values
       SET data = COALESCE($1, data),
         kpi_id = COALESCE($2, kpi_id),
         "data operator" = $3,
         target_required = COALESCE($4, target_required),
         uom = $5,
         kpi_type = COALESCE($6, kpi_type),
         piller_id = $7,
         formula = $8,
         source_kpi_value_ids = $9,
         default_target_value = $10,
         computation_type = $11,
         target_formula = $12,
         target_source_kpi_value_ids = $13,
         updated_at = NOW()
       WHERE id = $14
       RETURNING id, data, kpi_id, "data operator" AS data_operator, target_required, uom, kpi_type, 
           piller_id, formula, source_kpi_value_ids, default_target_value, computation_type, target_formula, target_source_kpi_value_ids, created_at, updated_at`,
      [
        data || null,
        kpi_id || null,
        data_operator || null,
        target_required !== undefined ? target_required : null,
        uom || null,
        kpi_type || null,
        piller_id || null,
        formula || null,
        source_kpi_value_ids || null,
        default_target_value || null,
        kpiValue.computation_type || null,
        kpiValue.target_formula || null,
        kpiValue.target_source_kpi_value_ids || null,
        id
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateKPIValue:', error);
    throw error;
  }
};

// Delete KPI value
exports.deleteKPIValue = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_values WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteKPIValue:', error);
    throw error;
  }
};
