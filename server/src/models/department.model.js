const pool = require('../config/db');

// Get all departments
exports.getAllDepartments = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM departments ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllDepartments:', error);
    throw error;
  }
};

// Get department by ID
exports.getDepartmentById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM departments WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getDepartmentById:', error);
    throw error;
  }
};

// Get department by name
exports.getDepartmentByName = async (departmentName) => {
  try {
    const result = await pool.query(
      'SELECT * FROM departments WHERE department_name = $1',
      [departmentName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getDepartmentByName:', error);
    throw error;
  }
};

// Create department
exports.createDepartment = async (departmentName) => {
  try {
    const result = await pool.query(
      'INSERT INTO departments (department_name) VALUES ($1) RETURNING *',
      [departmentName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createDepartment:', error);
    throw error;
  }
};

// Update department
exports.updateDepartment = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.department_name !== undefined) {
      fields.push(`department_name = $${paramCount}`);
      values.push(updates.department_name);
      paramCount++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length === 1) {
      // Only updated_at was set
      const result = await pool.query(
        'UPDATE departments SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    }

    values.push(id);
    const query = `UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateDepartment:', error);
    throw error;
  }
};

// Delete department (hard delete)
exports.deleteDepartment = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteDepartment:', error);
    throw error;
  }
};
