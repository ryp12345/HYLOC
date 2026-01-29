const pool = require('../config/db');

// Get all categories
exports.getAllCategories = async () => {
  try {
    const result = await pool.query(
      'SELECT id, category_name, created_at, updated_at FROM categories ORDER BY id ASC'
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllCategories:', error);
    throw error;
  }
};

// Get category by ID
exports.getCategoryById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT id, category_name, created_at, updated_at FROM categories WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getCategoryById:', error);
    throw error;
  }
};

// Get category by name
exports.getCategoryByName = async (categoryName) => {
  try {
    const result = await pool.query(
      'SELECT id, category_name, created_at, updated_at FROM categories WHERE category_name = $1',
      [categoryName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getCategoryByName:', error);
    throw error;
  }
};
