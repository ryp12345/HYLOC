const db = require('../config/db');

/**
 * Grant annual leave entitlements for all users for a given year.
 * - leave_entitled: 12
 * - leaves_accumulated: carryover from previous year balance (if any, min 0)
 * - leaves_availed: 0
 *
 * @param {number} year - Calendar year to grant entitlements for
 * @returns {Promise<number>} number of rows inserted
 */
exports.grantAnnualEntitlementsForYear = async (year) => {
  const prevYear = year - 1;

  const query = `
    WITH previous AS (
      SELECT
        user_id,
        GREATEST(leave_entitled + leaves_accumulated - leaves_availed, 0) AS carryover
      FROM leaves_entitlement
      WHERE year = $1
    ),
    users_list AS (
      SELECT id AS user_id
      FROM users
    )
    INSERT INTO leaves_entitlement (
      user_id, year, leave_entitled, leaves_accumulated, leaves_availed
    )
    SELECT
      u.user_id,
      $2,
      12.0,
      COALESCE(p.carryover, 0.0),
      0.0
    FROM users_list u
    LEFT JOIN previous p ON p.user_id = u.user_id
    ON CONFLICT (user_id, year) DO NOTHING
    RETURNING id
  `;

  const result = await db.query(query, [prevYear, year]);
  return result.rowCount || 0;
};
