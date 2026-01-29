const pool = require('../config/db');

// Get all KPI-Department mappings
exports.getAllKPIDepartments = async () => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, department_id FROM kpi_departments ORDER BY id DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllKPIDepartments:', error);
    throw error;
  }
};

// Get KPI-Department mappings by KPI ID
exports.getKPIDepartmentsByKPI = async (kpiId) => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, department_id FROM kpi_departments WHERE kpi_id = $1',
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIDepartmentsByKPI:', error);
    throw error;
  }
};

// Get KPI-Department mappings by Department ID
exports.getKPIDepartmentsByDepartment = async (departmentId) => {
  try {
    const result = await pool.query(
      'SELECT id, kpi_id, department_id FROM kpi_departments WHERE department_id = $1',
      [departmentId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIDepartmentsByDepartment:', error);
    throw error;
  }
};

// Create KPI-Department mapping
exports.createKPIDepartment = async (kpiId, departmentId) => {
  try {
    const result = await pool.query(
      `INSERT INTO kpi_departments (kpi_id, department_id)
       VALUES ($1, $2) RETURNING id, kpi_id, department_id`,
      [kpiId, departmentId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createKPIDepartment:', error);
    throw error;
  }
};

// Delete KPI-Department mapping
exports.deleteKPIDepartment = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_departments WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteKPIDepartment:', error);
    throw error;
  }
};

// Delete KPI-Department mappings by KPI ID
exports.deleteKPIDepartmentsByKPI = async (kpiId) => {
  try {
    const result = await pool.query(
      'DELETE FROM kpi_departments WHERE kpi_id = $1 RETURNING id',
      [kpiId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in deleteKPIDepartmentsByKPI:', error);
    throw error;
  }
};

// Check if mapping exists
exports.mappingExists = async (kpiId, departmentId) => {
  try {
    const result = await pool.query(
      'SELECT id FROM kpi_departments WHERE kpi_id = $1 AND department_id = $2',
      [kpiId, departmentId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database error in mappingExists:', error);
    throw error;
  }
};
