const pool = require('../config/db');

// Get all associations
exports.getAllAssociations = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM associations ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllAssociations:', error);
    throw error;
  }
};

// Get association by ID
exports.getAssociationById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM associations WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getAssociationById:', error);
    throw error;
  }
};

// Get association by name
exports.getAssociationByName = async (associationName) => {
  try {
    const result = await pool.query(
      'SELECT * FROM associations WHERE association_name = $1',
      [associationName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getAssociationByName:', error);
    throw error;
  }
};

// Create association
exports.createAssociation = async (associationName, status = 'active') => {
  try {
    const result = await pool.query(
      'INSERT INTO associations (association_name, status) VALUES ($1, $2) RETURNING *',
      [associationName, status]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createAssociation:', error);
    throw error;
  }
};

// Update association
exports.updateAssociation = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.association_name !== undefined) {
      fields.push(`association_name = $${paramCount}`);
      values.push(updates.association_name);
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
        'UPDATE associations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    }

    values.push(id);
    const query = `UPDATE associations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateAssociation:', error);
    throw error;
  }
};

// Delete association (hard delete)
exports.deleteAssociation = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM associations WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in deleteAssociation:', error);
    throw error;
  }
};
