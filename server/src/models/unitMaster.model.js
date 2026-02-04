const pool = require('../config/db');

class UnitMaster {
  static async findAll() {
    const result = await pool.query(
      `SELECT id, unit_name, symbol, created_at, updated_at
       FROM unit_master
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, unit_name, symbol, created_at, updated_at
       FROM unit_master WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async create(unit) {
    const result = await pool.query(
      `INSERT INTO unit_master (unit_name, symbol)
       VALUES ($1, $2)
       RETURNING id, unit_name, symbol, created_at, updated_at`,
      [unit.unit_name, unit.symbol || null]
    );
    return result.rows[0];
  }

  static async update(id, unit) {
    const result = await pool.query(
      `UPDATE unit_master
       SET unit_name = COALESCE($1, unit_name), symbol = COALESCE($2, symbol), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, unit_name, symbol, created_at, updated_at`,
      [unit.unit_name || null, unit.symbol || null, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM unit_master WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  }
}

module.exports = UnitMaster;
