const pool = require('../config/db');

// Get all designations
exports.getAllDesignations = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM designations ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllDesignations:', error);
    throw error;
  }
};

// Get designation by ID
exports.getDesignationById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM designations WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getDesignationById:', error);
    throw error;
  }
};

// Get designation by name
exports.getDesignationByName = async (designationName) => {
  try {
    const result = await pool.query(
      'SELECT * FROM designations WHERE designation_name = $1',
      [designationName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getDesignationByName:', error);
    throw error;
  }
};

// Create designation
exports.createDesignation = async (designationName, status = 'active') => {
  try {
    const result = await pool.query(
      'INSERT INTO designations (designation_name, status) VALUES ($1, $2) RETURNING *',
      [designationName, status]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createDesignation:', error);
    throw error;
  }
};

// Update designation
exports.updateDesignation = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.designation_name !== undefined) {
      fields.push(`designation_name = $${paramCount}`);
      values.push(updates.designation_name);
      paramCount++;
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(updates.status);
      paramCount++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length === 1) {
      // Only updated_at was set
      const result = await pool.query(
        'UPDATE designations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    }

    values.push(id);
    const query = `UPDATE designations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateDesignation:', error);
    throw error;
  }
};

// Delete designation (hard delete)
exports.deleteDesignation = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM designations WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteDesignation:', error);
    throw error;
  }
};
