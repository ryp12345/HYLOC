const pool = require('../config/db');

// Get all KPI-Employee mappings
exports.getAllKPIEmployees = async () => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, emp_id FROM kpi_employees ORDER BY id DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllKPIEmployees:', error);
    throw error;
  }
};

// Get KPI-Employee mappings by KPI ID
exports.getKPIEmployeesByKPI = async (kpiId) => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, emp_id FROM kpi_employees WHERE kpi_id = $1',
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIEmployeesByKPI:', error);
    throw error;
  }
};

// Get KPI-Employee mappings by Employee ID
exports.getKPIEmployeesByEmployee = async (empId) => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, emp_id FROM kpi_employees WHERE emp_id = $1',
      [empId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIEmployeesByEmployee:', error);
    throw error;
  }
};

// Create KPI-Employee mapping
exports.createKPIEmployee = async (kpiId, empId) => {
  try {
    const result = await pool.query(
      `INSERT INTO kpi_employees (kpi_id, emp_id)
       VALUES ($1, $2) RETURNING id, kpi_id, emp_id`,
      [kpiId, empId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createKPIEmployee:', error);
    throw error;
  }
};

// Delete KPI-Employee mapping
exports.deleteKPIEmployee = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_employees WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteKPIEmployee:', error);
    throw error;
  }
};

// Delete KPI-Employee mappings by KPI ID
exports.deleteKPIEmployeesByKPI = async (kpiId) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_employees WHERE kpi_id = $1 RETURNING id',
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in deleteKPIEmployeesByKPI:', error);
    throw error;
  }
};

// Check if mapping exists
exports.mappingExists = async (kpiId, empId) => {
  try {
    const result = await pool.query(
      'SELECT id FROM kpi_employees WHERE kpi_id = $1 AND emp_id = $2',
      [kpiId, empId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database error in mappingExists:', error);
    throw error;
  }
};
