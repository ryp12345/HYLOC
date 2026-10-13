-- Allow fractional default targets (e.g. 95.5%); the column was integer and truncated them
ALTER TABLE public.kpi_values
  ALTER COLUMN default_target_value TYPE numeric USING default_target_value::numeric;

-- Leave type default must be one of the values the application uses
ALTER TABLE public.leaves
  ALTER COLUMN leave_type SET DEFAULT 'Earned Leave';
