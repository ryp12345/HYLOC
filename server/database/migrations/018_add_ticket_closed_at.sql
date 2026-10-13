-- Record when a ticket was closed or rejected, so resolution time and late closure
-- are not affected by later edits (which change updated_at).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS closed_at timestamp without time zone;

-- Backfill existing closed/rejected tickets with the best available value
UPDATE public.tickets
SET closed_at = updated_at
WHERE closed_at IS NULL
  AND LOWER(status::text) IN ('closed', 'rejected');
