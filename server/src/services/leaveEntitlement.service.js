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
    users_list AS (
      SELECT
        id AS user_id,
        created_at::date AS joining_date,
        EXTRACT(YEAR FROM created_at)::int AS joining_year
      FROM users
    ),
    first_following_year AS (
      SELECT
        u.user_id,
        LEAST(
          15,
          CEIL(
            GREATEST(
              (
                ((DATE_TRUNC('year', u.joining_date) + INTERVAL '1 year - 1 day')::date - u.joining_date + 1)
                - COALESCE(s.sunday_count, 0)
              ),
              0
            ) / 20.0
          )
        )::numeric(4,1) AS first_year_entitled
      FROM users_list u
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS sunday_count
        FROM generate_series(
          u.joining_date,
          (DATE_TRUNC('year', u.joining_date) + INTERVAL '1 year - 1 day')::date,
          INTERVAL '1 day'
        ) AS d
        WHERE EXTRACT(DOW FROM d) = 0
      ) s ON TRUE
    )
    INSERT INTO leaves_entitlement (
      user_id, year, leave_entitled, leaves_accumulated, leaves_availed
    )
    SELECT
      u.user_id,
      $2,
      CASE
        WHEN $2 <= u.joining_year THEN 0.0
        WHEN $2 = u.joining_year + 1 THEN COALESCE(f.first_year_entitled, 0.0)
        ELSE 15.0
      END,
      COALESCE(p.carryover, 0.0),
      0.0
    FROM users_list u
    LEFT JOIN previous p ON p.user_id = u.user_id
    LEFT JOIN first_following_year f ON f.user_id = u.user_id
    ON CONFLICT (user_id, year) DO NOTHING
    RETURNING id
  `;

  const result = await db.query(query, [prevYear, year]);
  return result.rowCount || 0;
};
