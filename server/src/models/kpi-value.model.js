const pool = require('../config/db');

// Get all KPI values
exports.getAllKPIValues = async () => {
  try {
    const result = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
              kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
              kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
              kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
       FROM kpi_values kv
       ORDER BY kv.created_at DESC`
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
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
              kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
              kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
              kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE kv.kpi_id = $1 
       ORDER BY kv.created_at DESC`,
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIValuesByKPI for kpi_id', kpiId, ':', error.message);
    throw error;
  }
};

// Get KPI values by Pillar ID
exports.getKPIValuesByPillar = async (pillerId) => {
  try {
    const result = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
              kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
              kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
              kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE kv.piller_id = $1 
       ORDER BY kv.created_at DESC`,
      [pillerId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIValuesByPillar for pillar_id', pillerId, ':', error.message);
    throw error;
  }
};

// Get KPI value by ID
exports.getKPIValueById = async (id) => {
  try {
    const result = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
              kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
              kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
              kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE kv.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database error in getKPIValueById:', error);
    throw error;
  }
};

// Get KPI value by data field (case-insensitive, trimmed match)
exports.getKPIValueByData = async (dataValue) => {
  try {
    const result = await pool.query(
      `SELECT kv.id, kv.data, kv.kpi_id, kv."data operator" AS data_operator, 
              kv.target_required, kv.uom, kv.kpi_type, kv.piller_id, kv.formula, 
              kv.source_kpi_value_ids, kv.default_target_value, kv.computation_type, 
              kv.target_formula, kv.target_source_kpi_value_ids, kv.created_at, kv.updated_at
       FROM kpi_values kv
       WHERE LOWER(TRIM(kv.data)) = LOWER(TRIM($1))`,
      [dataValue]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database error in getKPIValueByData:', error);
    throw error;
  }
};

const RETURNING_COLUMNS = `id, data, kpi_id, "data operator" AS data_operator, target_required, uom, kpi_type,
           piller_id, formula, source_kpi_value_ids, default_target_value, computation_type,
           target_formula, target_source_kpi_value_ids, created_at, updated_at`;

// '' and undefined are stored as NULL; 0 is a valid value (e.g. a zero-accident target)
const toNullable = (value) => (value === undefined || value === '' ? null : value);

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
        formula, source_kpi_value_ids, default_target_value, computation_type, target_formula, target_source_kpi_value_ids,
        created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING ${RETURNING_COLUMNS}`,
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
        toNullable(default_target_value),
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
// Only fields present in the request are changed; an omitted field keeps its stored value.
// data, kpi_id, target_required and kpi_type are never cleared (null keeps the stored value).
exports.updateKPIValue = async (id, kpiValue) => {
  try {
    const columns = [
      { key: 'data', column: 'data', keepOnNull: true },
      { key: 'kpi_id', column: 'kpi_id', keepOnNull: true },
      { key: 'data_operator', column: '"data operator"', toValue: v => v || null },
      { key: 'target_required', column: 'target_required', keepOnNull: true },
      { key: 'uom', column: 'uom', toValue: v => v || null },
      { key: 'kpi_type', column: 'kpi_type', keepOnNull: true },
      { key: 'piller_id', column: 'piller_id', toValue: v => v || null },
      { key: 'formula', column: 'formula', toValue: v => v || null },
      { key: 'source_kpi_value_ids', column: 'source_kpi_value_ids', toValue: v => v || null },
      { key: 'default_target_value', column: 'default_target_value', toValue: toNullable },
      { key: 'computation_type', column: 'computation_type', toValue: v => v || null },
      { key: 'target_formula', column: 'target_formula', toValue: v => v || null },
      { key: 'target_source_kpi_value_ids', column: 'target_source_kpi_value_ids', toValue: v => v || null }
    ];

    const setClause = [];
    const values = [];
    for (const { key, column, keepOnNull, toValue } of columns) {
      const raw = kpiValue[key];
      if (raw === undefined) continue;
      if (keepOnNull && (raw === null || raw === '')) continue;
      values.push(toValue ? toValue(raw) : raw);
      setClause.push(`${column} = $${values.length}`);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE kpi_values
       SET ${[...setClause, 'updated_at = NOW()'].join(', ')}
       WHERE id = $${values.length}
       RETURNING ${RETURNING_COLUMNS}`,
      values
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
