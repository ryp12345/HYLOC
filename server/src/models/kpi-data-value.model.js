const pool = require('../config/db');

// Get all KPI data values
exports.getAllKPIDataValues = async () => {
  try {
    const result = await pool.query(
      `SELECT id, kpi_value_id, value, value_type, month, year, created_at, updated_at
       FROM kpi_data_value ORDER BY year DESC, month DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllKPIDataValues:', error);
    throw error;
  }
};

// Get KPI data value by ID
exports.getKPIDataValueById = async (id) => {
  try {
    const result = await pool.query(
      `SELECT id, kpi_value_id, value, value_type, month, year, created_at, updated_at
       FROM kpi_data_value WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getKPIDataValueById:', error);
    throw error;
  }
};

// Get monthly data by KPI Value ID and optional year
exports.getMonthlyDataByKPIValue = async (kpiValueId, year = null) => {
  try {
    let query = `SELECT id, kpi_value_id, value, value_type, month, year, created_at, updated_at
                 FROM kpi_data_value WHERE kpi_value_id = $1`;
    const params = [kpiValueId];
    
    if (year !== null) {
      query += ` AND year = $2`;
      params.push(year);
    }
    
    query += ` ORDER BY year DESC, month ASC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database error in getMonthlyDataByKPIValue:', error);
    throw error;
  }
};

// Get data for multiple KPI values (for comparison)
exports.getMultipleKPIValuesData = async (kpiValueIds, year) => {
  try {
    if (!Array.isArray(kpiValueIds) || kpiValueIds.length === 0) {
      return [];
    }

    const placeholders = kpiValueIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT id, kpi_value_id, value, value_type, month, year, created_at, updated_at
                   FROM kpi_data_value 
                   WHERE kpi_value_id IN (${placeholders}) AND year = $${kpiValueIds.length + 1}
                   ORDER BY month ASC, kpi_value_id ASC`;
    
    const result = await pool.query(query, [...kpiValueIds, year]);
    return result.rows;
  } catch (error) {
    console.error('Database error in getMultipleKPIValuesData:', error);
    throw error;
  }
};

// Create KPI data value
exports.createKPIDataValue = async (kpiValueId, value, valueType, month, year) => {
  try {
    const result = await pool.query(
      `INSERT INTO kpi_data_value (kpi_value_id, value, value_type, month, year, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, kpi_value_id, value, value_type, month, year, created_at, updated_at`,
      [kpiValueId, value, valueType, month, year]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createKPIDataValue:', error);
    throw error;
  }
};

// Update KPI data value
exports.updateKPIDataValue = async (id, value, valueType) => {
  try {
    const result = await pool.query(
      `UPDATE kpi_data_value
       SET value = COALESCE($1, value),
           value_type = COALESCE($2, value_type),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, kpi_value_id, value, value_type, month, year, created_at, updated_at`,
      [value || null, valueType || null, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateKPIDataValue:', error);
    throw error;
  }
};

// Delete KPI data value
exports.deleteKPIDataValue = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_data_value WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteKPIDataValue:', error);
    throw error;
  }
};
