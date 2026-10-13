const pool = require('../config/db');

// Lets code use columns added by newer migrations without failing on a database
// where those migrations have not been applied yet.
const cache = new Map();
const RECHECK_MISSING_MS = 60 * 1000;

/**
 * Whether a column exists in the public schema.
 * A present column is cached for the life of the process; a missing one is re-checked
 * every minute, so running the migration takes effect without a restart.
 */
exports.columnExists = async (table, column) => {
  const key = `${table}.${column}`;
  const cached = cache.get(key);
  if (cached && (cached.exists || Date.now() - cached.checkedAt < RECHECK_MISSING_MS)) {
    return cached.exists;
  }

  const result = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  const exists = result.rows.length > 0;
  cache.set(key, { exists, checkedAt: Date.now() });
  return exists;
};

/**
 * SQL expression that reads an optional column, or NULL when it does not exist.
 * @param {string} rowRef - table name or alias, e.g. 'kv' or 'kpi_values'
 * @param {string} column - column name
 * @param {string} type - SQL type to cast to, e.g. 'boolean'
 */
exports.optionalColumn = (rowRef, column, type) =>
  `(to_jsonb(${rowRef})->>'${column}')::${type}`;
