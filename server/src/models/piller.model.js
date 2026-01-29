const pool = require('../config/db');

// Get all pillers
exports.getAllPillers = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM pillers ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllPillers:', error);
    throw error;
  }
};

// Get piller by ID
exports.getPillerById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pillers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getPillerById:', error);
    throw error;
  }
};

// Get piller by name
exports.getPillerByName = async (pillerName) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pillers WHERE piller_name = $1',
      [pillerName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getPillerByName:', error);
    throw error;
  }
};

// Create piller
exports.createPiller = async (pillerName, shortName) => {
  try {
    const result = await pool.query(
      'INSERT INTO pillers (piller_name, short_name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      [pillerName, shortName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createPiller:', error);
    throw error;
  }
};

// Update piller
exports.updatePiller = async (id, pillerName, shortName) => {
  try {
    const result = await pool.query(
      'UPDATE pillers SET piller_name = $2, short_name = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, pillerName, shortName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updatePiller:', error);
    throw error;
  }
};

// Delete piller
exports.deletePiller = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM pillers WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deletePiller:', error);
    throw error;
  }
};
