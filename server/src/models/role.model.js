const pool = require('../config/db');

// Get all roles
exports.getAllRoles = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllRoles:', error);
    throw error;
  }
};

// Get role by ID
exports.getRoleById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getRoleById:', error);
    throw error;
  }
};

// Get role by name
exports.getRoleByName = async (roleName) => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles WHERE role_name = $1',
      [roleName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getRoleByName:', error);
    throw error;
  }
};

// Create role
exports.createRole = async (roleName) => {
  try {
    const result = await pool.query(
      'INSERT INTO roles (role_name) VALUES ($1) RETURNING *',
      [roleName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createRole:', error);
    throw error;
  }
};

// Update role
exports.updateRole = async (id, roleName) => {
  try {
    // Detect actual column name for updated_at (handles casing differences)
    const colRes = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='roles' AND lower(column_name) = 'updated_at' LIMIT 1"
    );
    const updatedCol = colRes.rows[0] ? colRes.rows[0].column_name : 'updated_at';

    const query = `UPDATE roles SET role_name = $1, "${updatedCol}" = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [roleName, id]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateRole:', error);
    throw error;
  }
};

// Delete role
exports.deleteRole = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM roles WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteRole:', error);
    throw error;
  }
};
