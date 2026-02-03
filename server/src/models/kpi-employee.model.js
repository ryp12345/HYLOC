
const pool = require('../config/db');

class KPIEmployee {
  static async findAll() {
    try {
      const result = await pool.query('SELECT id, kpi_id, emp_id FROM kpi_emp ORDER BY id DESC');
      return result.rows;
    } catch (error) {
      console.error('Database error in findAll:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await pool.query('SELECT id, kpi_id, emp_id FROM kpi_emp WHERE id = $1', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Database error in findById:', error);
      throw error;
    }
  }

  static async findByKPI(kpiId) {
    try {
      const result = await pool.query('SELECT id, kpi_id, emp_id FROM kpi_emp WHERE kpi_id = $1', [kpiId]);
      return result.rows;
    } catch (error) {
      console.error('Database error in findByKPI:', error);
      throw error;
    }
  }

  static async findByEmployee(empId) {
    try {
      const result = await pool.query('SELECT id, kpi_id, emp_id FROM kpi_emp WHERE emp_id = $1', [empId]);
      return result.rows;
    } catch (error) {
      console.error('Database error in findByEmployee:', error);
      throw error;
    }
  }

  static async create(kpiId, empId) {
    try {
      const result = await pool.query(
        `INSERT INTO kpi_emp (kpi_id, emp_id)
         VALUES ($1, $2) RETURNING id, kpi_id, emp_id`,
        [kpiId, empId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Database error in create:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await pool.query('DELETE FROM kpi_emp WHERE id = $1 RETURNING id', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Database error in delete:', error);
      throw error;
    }
  }

  static async deleteByKPI(kpiId) {
    try {
      const result = await pool.query('DELETE FROM kpi_emp WHERE kpi_id = $1 RETURNING id', [kpiId]);
      return result.rows;
    } catch (error) {
      console.error('Database error in deleteByKPI:', error);
      throw error;
    }
  }

  static async mappingExists(kpiId, empId) {
    try {
      const result = await pool.query('SELECT id FROM kpi_emp WHERE kpi_id = $1 AND emp_id = $2', [kpiId, empId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database error in mappingExists:', error);
      throw error;
    }
  }
}

module.exports = KPIEmployee;
