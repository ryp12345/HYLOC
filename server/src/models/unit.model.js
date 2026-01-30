const pool = require('../config/db');

// Get all units from unit_master
exports.getAllUnits = async () => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM unit_master
       ORDER BY unit_name ASC`
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllUnits:', error);
    throw error;
  }
};