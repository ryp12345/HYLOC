-- One-off repair: entitlement rows created before their year started.
--
-- Why: the old scheduler ran every day and created next year's rows from the current
-- year's incomplete data (partial working days, carryover before the year's leave was taken).
-- The fixed scheduler runs on 1 January and fills placeholder rows
-- (leave_entitled = 0 AND leaves_accumulated = 0), so resetting future-year rows to
-- placeholders lets it recompute them from complete data. leaves_availed is kept.
--
-- NOT run automatically. Run step 1, review, then run step 2.

-- Step 1a: rows for years that have not started yet (these were created early)
SELECT le.id, le.user_id, u.empid, le.year, le.leave_entitled, le.leaves_accumulated,
       le.leaves_availed, le.created_at
FROM leaves_entitlement le
LEFT JOIN users u ON u.id = le.user_id
WHERE le.year > EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY le.year, u.empid;

-- Step 1b: rows for the current or earlier years that were also created before their year began.
-- These may have been corrected by HR since; review them individually rather than resetting.
SELECT le.id, le.user_id, u.empid, le.year, le.leave_entitled, le.leaves_accumulated,
       le.leaves_availed, le.created_at
FROM leaves_entitlement le
LEFT JOIN users u ON u.id = le.user_id
WHERE le.year <= EXTRACT(YEAR FROM CURRENT_DATE)
  AND le.created_at < make_date(le.year, 1, 1)
ORDER BY le.year, u.empid;

-- Step 2: reset the future-year rows from step 1a (uncomment after reviewing)
-- BEGIN;
-- UPDATE leaves_entitlement
-- SET leave_entitled = 0,
--     leaves_accumulated = 0,
--     updated_at = NOW()
-- WHERE year > EXTRACT(YEAR FROM CURRENT_DATE);
-- COMMIT;
