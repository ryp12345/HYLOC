const pool = require('../config/db');

// Get all user roles with user and role details
exports.getAllUserRoles = async () => {
  try {
    const result = await pool.query(`
      SELECT 
        ur.id,
        ur.user_id,
        ur.role_id,
        ur.status,
        ur.created_at,
        ur.updated_at,
        u.email,
        u.firstname,
        u.lastname,
        u.empid,
        r.role_name
      FROM user_roles ur
      LEFT JOIN users u ON ur.user_id = u.id
      LEFT JOIN roles r ON ur.role_id = r.id
      ORDER BY ur.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllUserRoles:', error);
    throw error;
  }
};

// Get user role by ID
exports.getUserRoleById = async (id) => {
  try {
    const result = await pool.query(`
      SELECT 
        ur.id,
        ur.user_id,
        ur.role_id,
        ur.status,
        ur.created_at,
        ur.updated_at,
        u.email,
        u.firstname,
        u.lastname,
        u.empid,
        r.role_name
      FROM user_roles ur
      LEFT JOIN users u ON ur.user_id = u.id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ur.id = $1
    `, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getUserRoleById:', error);
    throw error;
  }
};

// Create user role
exports.createUserRole = async (userId, roleId, status = 'active') => {
  try {
    const result = await pool.query(`
      INSERT INTO user_roles (user_id, role_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `, [userId, roleId, status]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createUserRole:', error);
    throw error;
  }
};

// Update user role
exports.updateUserRole = async (id, userId, roleId, status) => {
  try {
    const result = await pool.query(`
      UPDATE user_roles
      SET user_id = $2, role_id = $3, status = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, userId, roleId, status]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateUserRole:', error);
    throw error;
  }
};

// Delete user role
exports.deleteUserRole = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM user_roles WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteUserRole:', error);
    throw error;
  }
};

// Get user roles by user ID
exports.getUserRolesByUserId = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT 
        ur.id,
        ur.user_id,
        ur.role_id,
        ur.status,
        ur.created_at,
        ur.updated_at,
        r.role_name
      FROM user_roles ur
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
      ORDER BY ur.created_at DESC
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Database error in getUserRolesByUserId:', error);
    throw error;
  }
};
