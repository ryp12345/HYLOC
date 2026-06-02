const db = require('../config/db');

/**
 * Grant annual leave entitlements for all users for a given year.
 * - leave_entitled:
 *   - 0 in joining year
 *   - ceil((remaining days in joining year - Sundays from join date to Dec 31) / 20), capped at 15, in first Jan 1 after joining year
 *   - 15 in each subsequent year
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
    monthly_totals AS (
      SELECT
        user_id,
        COALESCE(jan_duration, 0) +
        COALESCE(feb_duration, 0) +
        COALESCE(mar_duration, 0) +
        COALESCE(apr_duration, 0) +
        COALESCE(may_duration, 0) +
        COALESCE(jun_duration, 0) +
        COALESCE(jul_duration, 0) +
        COALESCE(aug_duration, 0) +
        COALESCE(sep_duration, 0) +
        COALESCE(oct_duration, 0) +
        COALESCE(nov_duration, 0) +
        COALESCE(dec_duration, 0) AS total_no_of_days
      FROM employee_monthly_working_days
      WHERE year = $1
    ),
    users_list AS (
      SELECT
        id AS user_id,
        created_at::date AS joining_date,
        EXTRACT(YEAR FROM created_at)::int AS joining_year
      FROM users
    )
    INSERT INTO leaves_entitlement (
      user_id, year, leave_entitled, leaves_accumulated, leaves_availed
    )
    SELECT
      u.user_id,
      $2,
      CASE
        WHEN $2 <= u.joining_year THEN 0.0
        ELSE LEAST(FLOOR((COALESCE(mt.total_no_of_days, 0) / 20.0) + 0.5), 15)::numeric(4,1)
      END,
      COALESCE(p.carryover, 0.0),
      0.0
    FROM users_list u
    LEFT JOIN previous p ON p.user_id = u.user_id
    LEFT JOIN monthly_totals mt ON mt.user_id = u.user_id
    ON CONFLICT (user_id, year) DO NOTHING
    RETURNING id
  `;

  const result = await db.query(query, [prevYear, year]);
  return result.rowCount || 0;
};
