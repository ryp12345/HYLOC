const db = require('../config/db');

/**
 * Grant annual leave entitlements for all users for a given year.
 * - leave_entitled:
 *   - 0 in the joining year (joining date = users.created_at)
 *   - every later year: round-half-up(previous year's working days / 20), capped at 15
 *     (same rule as computeEntitledDays in leaveEntitlement.controller.js)
 * - leaves_accumulated: carryover of the previous year's balance (min 0)
 * - leaves_availed: 0 for new rows; kept as-is for existing rows
 *
 * Existing rows are only filled in when they are still placeholders
 * (leave_entitled = 0 and leaves_accumulated = 0), e.g. a row created when someone applied
 * for leave in the new year before this ran. Rows set by HR are never overwritten.
 *
 * @param {number} year - Calendar year to grant entitlements for
 * @returns {Promise<number>} number of rows inserted or filled
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
    ON CONFLICT (user_id, year) DO UPDATE
      SET leave_entitled = EXCLUDED.leave_entitled,
          leaves_accumulated = EXCLUDED.leaves_accumulated,
          updated_at = NOW()
      WHERE leaves_entitlement.leave_entitled = 0
        AND leaves_entitlement.leaves_accumulated = 0
        AND (EXCLUDED.leave_entitled <> 0 OR EXCLUDED.leaves_accumulated <> 0)
    RETURNING id
  `;

  const result = await db.query(query, [prevYear, year]);
  return result.rowCount || 0;
};
