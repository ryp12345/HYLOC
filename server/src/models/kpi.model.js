const pool = require('../config/db');

// Get all KPIs
exports.getAllKPIs = async () => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              c.category_name, k.created_at, k.updated_at
       FROM kpis k
       LEFT JOIN categories c ON k.category_id = c.id
       ORDER BY k.created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllKPIs:', error);
    throw error;
  }
};

// Get KPI by ID
exports.getKPIById = async (id) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year, 
              c.category_name, k.created_at, k.updated_at
       FROM kpis k
       LEFT JOIN categories c ON k.category_id = c.id
       WHERE k.id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getKPIById:', error);
    throw error;
  }
};

// Get KPIs by category
exports.getKPIsByCategory = async (categoryId) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              c.category_name, k.created_at, k.updated_at
       FROM kpis k
       LEFT JOIN categories c ON k.category_id = c.id
       WHERE k.category_id = $1 ORDER BY k.created_at DESC`,
      [categoryId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIsByCategory:', error);
    throw error;
  }
};

// Get KPIs by financial year
exports.getKPIsByFinYear = async (finYear) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              c.category_name, k.created_at, k.updated_at
       FROM kpis k
       LEFT JOIN categories c ON k.category_id = c.id
       WHERE k.fin_year = $1 ORDER BY k.created_at DESC`,
      [finYear]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getKPIsByFinYear:', error);
    throw error;
  }
};

// Create KPI
exports.createKPI = async (title, categoryId, parentKpiId, finYear) => {
  try {
    const result = await pool.query(
      `INSERT INTO kpis (title, category_id, parent_kpi_id, fin_year, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, title, category_id, parent_kpi_id, fin_year, created_at, updated_at`,
      [title, categoryId, parentKpiId || null, finYear || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createKPI:', error);
    throw error;
  }
};

// Update KPI
exports.updateKPI = async (id, title, categoryId, parentKpiId, finYear) => {
  try {
    const result = await pool.query(
      `UPDATE kpis
       SET title = COALESCE($1, title),
           category_id = COALESCE($2, category_id),
           parent_kpi_id = $3,
           fin_year = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, title, category_id, parent_kpi_id, fin_year, created_at, updated_at`,
      [title || null, categoryId || null, parentKpiId || null, finYear || null, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateKPI:', error);
    throw error;
  }
};

// Delete KPI
exports.deleteKPI = async (id) => {
  try {
    // Delete dependent rows first to avoid FK constraint violations
    await pool.query('BEGIN');

    // Delete KPI-Department mappings
    await pool.query('DELETE FROM kpi_departments WHERE kpi_id = $1', [id]);

    // Delete KPI-Employee mappings
    await pool.query('DELETE FROM kpi_emp WHERE kpi_id = $1', [id]);

    // Delete KPI values associated with this KPI
    await pool.query('DELETE FROM kpi_values WHERE kpi_id = $1', [id]);

    // If there are other dependent tables referencing kpis, delete/update them here

    // Finally delete the KPI
    const result = await pool.query('DELETE FROM kpis WHERE id = $1 RETURNING id', [id]);

    await pool.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch (e) { console.error('Rollback failed', e); }
    console.error('Database error in deleteKPI:', error);
    throw error;
  }
};

// Check if KPI has children
exports.hasChildren = async (id) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM kpis WHERE parent_kpi_id = $1',
      [id]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Database error in hasChildren:', error);
    throw error;
  }
};

// Get child KPIs
exports.getChildKPIs = async (parentId) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.title, k.category_id, k.parent_kpi_id, k.fin_year,
              c.category_name, k.created_at, k.updated_at
       FROM kpis k
       LEFT JOIN categories c ON k.category_id = c.id
       WHERE k.parent_kpi_id = $1 ORDER BY k.created_at DESC`,
      [parentId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getChildKPIs:', error);
    throw error;
  }
};
