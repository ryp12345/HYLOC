/**
 * Finds accounts still using the old shared default password and (with --apply)
 * marks them must_change_password, so they are forced to pick their own password
 * at next login. Their current password keeps working until then.
 *
 * Needs migration 024_add_user_must_change_password.sql.
 * Uses the same database settings as the app (server/.env).
 *
 * Usage (from the server folder):
 *   node scripts/flagDefaultPasswordAccounts.js            # report only, changes nothing
 *   node scripts/flagDefaultPasswordAccounts.js --apply    # flag the accounts found
 *
 * Prints only counts and employee IDs, never passwords or hashes.
 */
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

const OLD_DEFAULT_PASSWORDS = ['Password@123'];

const run = async () => {
  const apply = process.argv.includes('--apply');
  const { rows } = await pool.query(
    `SELECT id, empid, password FROM users
     WHERE must_change_password = false AND password IS NOT NULL`
  );

  const matches = [];
  for (const user of rows) {
    for (const candidate of OLD_DEFAULT_PASSWORDS) {
      if (await bcrypt.compare(candidate, user.password)) {
        matches.push(user);
        break;
      }
    }
  }

  console.log(`Checked ${rows.length} accounts; ${matches.length} still use the old default password.`);
  if (matches.length) {
    console.log('Employee IDs:', matches.map((u) => u.empid || `(id ${u.id})`).join(', '));
  }

  if (!apply) {
    console.log('Report only. Run again with --apply to require these accounts to change password at next login.');
    return;
  }
  if (matches.length) {
    const result = await pool.query(
      'UPDATE users SET must_change_password = true, updated_at = NOW() WHERE id = ANY($1::int[])',
      [matches.map((u) => u.id)]
    );
    console.log(`Flagged ${result.rowCount} accounts.`);
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
