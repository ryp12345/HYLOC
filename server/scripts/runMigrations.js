/**
 * Run specific migration files from database/migrations in one transaction.
 * Uses the same database settings as the app (server/.env).
 *
 * Usage (from the server folder):
 *   node scripts/runMigrations.js 018_add_ticket_closed_at.sql 019_kpi_direction_and_defaults.sql
 *
 * If any statement fails, nothing is changed.
 */
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const migrationsDir = path.join(__dirname, '../database/migrations');

const run = async () => {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Give the migration file names to run, e.g.\n  node scripts/runMigrations.js 018_add_ticket_closed_at.sql');
    process.exit(1);
  }

  for (const file of files) {
    if (!fs.existsSync(path.join(migrationsDir, file))) {
      console.error(`Not found: database/migrations/${file}`);
      process.exit(1);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Applied: ${file}`);
    }
    await client.query('COMMIT');
    console.log('All migrations committed.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration failed, nothing was changed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  // Show the result
  const check = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tickets' AND column_name = 'closed_at'`
  );
  console.log('tickets.closed_at present:', check.rows.length > 0 ? 'yes' : 'no');
  await pool.end();
};

run().catch(async (error) => {
  console.error(error.message);
  process.exit(1);
});
