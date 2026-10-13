-- The "higher / lower is better" setting per KPI value is not used.
-- Removes the column wherever an earlier version of migration 019 added it.
-- Safe to run on any database: does nothing if the column does not exist.
ALTER TABLE public.kpi_values
  DROP COLUMN IF EXISTS higher_is_better;
