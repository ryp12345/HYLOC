-- One-off repair: recompute leaves_entitlement.leaves_availed from the leaves table.
--
-- Why: before the fix, rejecting a leave did not return its Earned Leave days, and
-- cancelling a leave as HR/HOD/Management credited the canceller instead of the owner.
-- Balances can therefore be wrong for existing data.
--
-- Rule (same as the application): Earned Leave days count against the year of the
-- leave's start date while the leave is Pending or Approved.
--
-- NOT run automatically. Run step 1, review, then run step 2.
-- Caution: step 2 overwrites any manual leaves_availed adjustments made by HR.

-- Step 1: preview the rows that would change
WITH computed AS (
  SELECT user_id,
         EXTRACT(YEAR FROM from_date)::int AS year,
         SUM(credited_days) AS availed
  FROM leaves
  WHERE LOWER(TRIM(leave_type)) = 'earned leave'
    AND status IN ('Pending', 'Approved')
  GROUP BY user_id, EXTRACT(YEAR FROM from_date)
)
SELECT le.user_id,
       u.empid,
       COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS user_name,
       le.year,
       le.leaves_availed AS current_availed,
       COALESCE(c.availed, 0) AS correct_availed,
       COALESCE(c.availed, 0) - le.leaves_availed AS difference
FROM leaves_entitlement le
LEFT JOIN computed c ON c.user_id = le.user_id AND c.year = le.year
LEFT JOIN users u ON u.id = le.user_id
WHERE le.leaves_availed <> COALESCE(c.availed, 0)
ORDER BY le.year, u.empid;

-- Step 2: apply (uncomment after reviewing step 1)
-- BEGIN;
-- WITH computed AS (
--   SELECT user_id,
--          EXTRACT(YEAR FROM from_date)::int AS year,
--          SUM(credited_days) AS availed
--   FROM leaves
--   WHERE LOWER(TRIM(leave_type)) = 'earned leave'
--     AND status IN ('Pending', 'Approved')
--   GROUP BY user_id, EXTRACT(YEAR FROM from_date)
-- )
-- UPDATE leaves_entitlement le
-- SET leaves_availed = COALESCE(c.availed, 0),
--     updated_at = NOW()
-- FROM leaves_entitlement le2
-- LEFT JOIN computed c ON c.user_id = le2.user_id AND c.year = le2.year
-- WHERE le.id = le2.id
--   AND le.leaves_availed <> COALESCE(c.availed, 0);
-- COMMIT;
