-- One value per KPI value, month, year and value type.
-- The calculation service relies on this key for ON CONFLICT upserts, and CUMSUM
-- would otherwise add duplicate rows together.
-- Safe to run more than once: does nothing if an equivalent unique index already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE t.relname = 'kpi_data_value'
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attnum = ANY (i.indkey)
      ) = ARRAY['kpi_value_id', 'month', 'value_type', 'year']
  ) THEN
    -- Keep the most recently updated row of each duplicate group
    DELETE FROM public.kpi_data_value d
    USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY kpi_value_id, month, year, value_type
               ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
             ) AS rn
      FROM public.kpi_data_value
    ) ranked
    WHERE d.id = ranked.id AND ranked.rn > 1;

    CREATE UNIQUE INDEX uq_kpi_data_value_period
      ON public.kpi_data_value (kpi_value_id, month, year, value_type);
  END IF;
END $$;
